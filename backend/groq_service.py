import os
import json
import random
import time

try:
    # Official OpenAI Python SDK pointed at Groq's OpenAI-compatible endpoint (pip: openai)
    from openai import OpenAI, APIStatusError, APIConnectionError, APITimeoutError
    _GROQ_SDK_AVAILABLE = True
except Exception:
    _GROQ_SDK_AVAILABLE = False

GROQ_API_URL = "https://api.groq.com/openai/v1"
GROQ_PRIMARY_MODEL = "openai/gpt-oss-120b"
GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile"
GROQ_MAX_OUTPUT_TOKENS = 4000
REQUEST_TIMEOUT_SECONDS = 45

# Number of rate-limit retries per model before switching to the fallback model /
# degrading to offline generation. Each attempt backs off (honoring the provider's
# Retry-After header, capped) so transient free-tier 429/413 limits recover instead of
# hard-failing. Caps keep the worst-case wait short: 2 attempts x 2 models x 6s = ~24s
# before degrading to offline, so multi-turn "add more" requests never spin for minutes.
MAX_RATE_LIMIT_RETRIES = 3
RATE_LIMIT_BACKOFF_BASE = 2.0
RATE_LIMIT_BACKOFF_CAP = 15.0
# Clamp any provider Retry-After header to this many seconds so a large free-tier TPM
# reset window (often 30-60s) never turns a single call into a multi-minute hang.
RATE_LIMIT_RETRY_AFTER_MAX = 6


def _rate_limit_delay(err, attempt):
    """Returns the seconds to wait before a rate-limit retry.

    Prefers the provider's `Retry-After` header (Groq sends it on 429) so we respect
    the reset window, but caps it to RATE_LIMIT_RETRY_AFTER_MAX so a huge free-tier
    TPM window can't stall a generation; otherwise falls back to exponential backoff.
    """
    try:
        headers = getattr(err, "response", None)
        retry_after = headers.headers.get("Retry-After") if headers is not None else None
        if retry_after:
            try:
                return min(float(retry_after), RATE_LIMIT_RETRY_AFTER_MAX)
            except (TypeError, ValueError):
                pass
    except Exception:
        pass
    return min(RATE_LIMIT_BACKOFF_CAP, RATE_LIMIT_BACKOFF_BASE * (2 ** (attempt - 1)))

# Cap total generation counts so each Groq response stays within the output-token
# budget (roughly 200 tokens per quiz question / flashcard). Large totals are generated
# in small batches: requests are split across content chunks AND the remaining total is
# cycled through the chunks in multiple rounds, so no single AI call ever asks for more
# than MAX_PER_CHUNK items (~2000 output tokens, safely under the 4096-token cap).
MAX_AI_QUESTIONS = 100
MAX_AI_FLASHCARDS = 100
MAX_PER_CHUNK = 10
# Safety ceiling on batching rounds (100 items / 10 per call = 10 rounds; 12 leaves headroom).
MAX_BATCH_ROUNDS = 12

# Pacing delay inserted between consecutive AI calls inside a batched generation so a
# large request (e.g. "add 20 more") doesn't burst several requests into the same free-tier
# rate-limit window right after the previous generation.
BATCH_CALL_PACING_SECONDS = 1.5

# Records the reason the most recent generation degraded to offline content-derived output,
# so callers can surface a clear "offline mode" notice instead of silently returning fallback results.
# "" (empty) means the live AI service was used.
_generation_used_fallback = ""


def reset_generation_source() -> None:
    """Resets the offline-fallback flag before a fresh generation request."""
    global _generation_used_fallback
    _generation_used_fallback = ""


def mark_offline_fallback(reason: str = "OFFLINE_USED") -> None:
    """Records the reason the current generation degraded to content-derived offline output.

    Reasons: NO_API_KEY | SDK_MISSING | BILLING_INACTIVE | OFFLINE_USED
    """
    global _generation_used_fallback
    _generation_used_fallback = reason


def generation_used_fallback() -> str:
    """Returns the offline-fallback reason, or '' when live AI was used."""
    return _generation_used_fallback

class GroqAPIError(Exception):
    """
    Structured API error propagated to Flask routes.
    Never contains the API key or raw provider payloads.
    """
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class GroqOfflineError(GroqAPIError):
    """
    Raised when the cloud AI provider cannot be used (no key / rate limit gate).
    Callers degrade to content-derived offline generation so learning continues.
    """
    def __init__(self, code: str, message: str = "AI provider unavailable; using local offline generation."):
        super().__init__(code, message)


def call_groq_ai(prompt: str, system_prompt: str = "You are StudyLens AI, an adaptive learning assistant powered by Groq Inference (GPT-OSS-120B).", temperature: float = 0.7) -> str:
    """
    Calls the Groq Inference API (OpenAI-compatible Responses API) using the
    GPT-OSS-120B large language model, retrying once with Llama-3.3-70B Versatile
    when the primary model is unavailable.

    - No API key configured  -> raises GroqOfflineError (offline/demo mode).
    - API errors             -> raises GroqAPIError with a safe, static message.
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not api_key or api_key == "your_groq_api_key_here":
        print("[Groq GPT-OSS-120B] No API key configured; using built-in content-derived offline generation.")
        raise GroqOfflineError("NO_API_KEY", "No API key configured.")

    if not _GROQ_SDK_AVAILABLE:
        print("[Groq GPT-OSS-120B] OpenAI SDK not installed; using built-in content-derived offline generation.")
        raise GroqOfflineError("SDK_MISSING", "OpenAI SDK is not installed.")

    client = OpenAI(api_key=api_key, base_url=GROQ_API_URL, timeout=REQUEST_TIMEOUT_SECONDS, max_retries=1)

    for model in (GROQ_PRIMARY_MODEL, GROQ_FALLBACK_MODEL):
        attempt = 0
        while attempt < MAX_RATE_LIMIT_RETRIES:
            attempt += 1
            try:
                response = client.responses.create(
                    model=model,
                    instructions=system_prompt,
                    input=prompt,
                    temperature=temperature,
                    max_output_tokens=GROQ_MAX_OUTPUT_TOKENS,
                )
            except APITimeoutError:
                raise GroqAPIError("TIMEOUT", "The AI service timed out. Please try again.")
            except APIConnectionError:
                raise GroqAPIError("API_UNAVAILABLE", "Could not reach the AI service. Please try again.")
            except APIStatusError as err:
                status = err.status_code
                if status in (401, 403):
                    raise GroqAPIError("INVALID_API_KEY", "AI service authentication failed. Please contact the administrator.")
                if status == 402:
                    # Payment/activation gating must NEVER block learners. Degrade to
                    # content-derived offline generation so StudyLens always returns a
                    # meaningful resource grounded in the actual material.
                    print("[Groq] Payment gate encountered (HTTP 402). Using content-derived offline generation fallback so learning is never interrupted.")
                    raise GroqOfflineError("BILLING_INACTIVE", "AI service billing is not active; using offline generation.")
                if status == 404:
                    # Requested model is unavailable for this provider -> try the fallback model.
                    break
                if status in (429, 413):
                    # Rate limited (429 RPM) or free-tier TPM budget exceeded (413
                    # rate_limit_exceeded). Honor Retry-After when the provider sends it,
                    # otherwise back off exponentially. Retry the SAME model a few times
                    # before switching to the fallback model, so transient free-tier limits
                    # recover instead of hard-failing the whole generation.
                    delay = _rate_limit_delay(err, attempt)
                    print(f"[Groq] Rate limit reached on {model} (HTTP {status}, attempt {attempt}/{MAX_RATE_LIMIT_RETRIES}). Backing off {delay:.0f}s.")
                    time.sleep(delay)
                    continue
                if status >= 500:
                    raise GroqAPIError("AI_SERVICE_DOWN", "The AI service is temporarily unavailable. Please try again.")
                raise GroqAPIError("API_ERROR", "The AI service returned an unexpected error. Please try again.")
            except Exception:
                raise GroqAPIError("API_ERROR", "Unexpected error while contacting the AI service.")

            try:
                text = getattr(response, "output_text", None)
                if text and text.strip():
                    return text.strip()
            except Exception:
                raise GroqAPIError("API_ERROR", "Received an invalid response from the AI service.")
            raise GroqAPIError("API_ERROR", "Received an empty response from the AI service.")

    # Both models exhausted their rate-limit retries. Never leave the learner stuck with
    # a hard failure: degrade to content-derived offline generation (callers catch
    # GroqOfflineError and return locally generated questions grounded in the material).
    print("[Groq] Rate limit persisted on all models. Degrading to content-derived offline generation.")
    raise GroqOfflineError("RATE_LIMITED", "You have reached the AI generation limit for this session; using offline generation.")


GROQ_VISION_MODELS = (
    "llama-3.2-90b-vision-preview",
    "llama-3.2-11b-vision-preview",
    "meta-llama/llama-4-scout-17b-16e-instruct",
)

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp")


def describe_image_with_groq(image_base64: str, mime: str = "image/png") -> str:
    """Extracts readable text/context from an image using a vision-capable Groq model.

    Never raises: on any failure (missing key, SDK absent, model unavailable, timeout)
    it returns "" so callers can fall back to the filename-based description.

    Returns the model's extracted description text (trimmed), or "" on failure.
    """
    if not image_base64:
        return ""

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or api_key == "your_groq_api_key_here":
        print("[Groq Vision] No API key configured; skipping image text extraction.")
        return ""

    if not _GROQ_SDK_AVAILABLE:
        print("[Groq Vision] OpenAI SDK not installed; skipping image text extraction.")
        return ""

    try:
        client = OpenAI(api_key=api_key, base_url=GROQ_API_URL, timeout=REQUEST_TIMEOUT_SECONDS, max_retries=1)
        for model in GROQ_VISION_MODELS:
            try:
                response = client.responses.create(
                    model=model,
                    input=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_text",
                                    "text": "Extract all the text and key information from this image. "
                                            "Transcribe any visible text verbatim, then describe any "
                                            "diagrams, formulas, or figures as clear plain text so the "
                                            "content can be used for study material.",
                                },
                                {
                                    "type": "input_image",
                                    "image_url": f"data:{mime};base64,{image_base64}",
                                },
                            ],
                        }
                    ],
                    max_output_tokens=GROQ_MAX_OUTPUT_TOKENS,
                )
            except APIStatusError as err:
                if err.status_code == 404:
                    # Vision model unavailable -> try the next candidate.
                    continue
                if err.status_code in (429, 413):
                    time.sleep(2)
                    continue
                print(f"[Groq Vision] API error {err.status_code}; skipping image text extraction.")
                return ""
            except Exception as exc:
                print(f"[Groq Vision] Request failed ({type(exc).__name__}); skipping image text extraction.")
                return ""

            text = getattr(response, "output_text", None)
            if text and text.strip():
                return text.strip()[:12000]
        print("[Groq Vision] No vision-capable model available; skipping image text extraction.")
        return ""
    except Exception as exc:
        print(f"[Groq Vision] Unexpected error ({type(exc).__name__}); skipping image text extraction.")
        return ""


def _parse_json_answer(raw: str):
    """Extracts the first valid JSON value (array or object) from model output.

    Tolerates markdown code fences and prose wrapped around the JSON.
    """
    if not raw:
        return None

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].lstrip()

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Find the outermost JSON value amid surrounding prose/text.
    start_idx = None
    for idx, ch in enumerate(cleaned):
        if ch in "[{":
            start_idx = idx
            break
    if start_idx is None:
        print("[Groq JSON Parsing Error] No JSON value found in output.")
        return None

    depth = 0
    in_str = False
    escape = False
    quote = None
    end_idx = None
    for idx in range(start_idx, len(cleaned)):
        ch = cleaned[idx]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                in_str = False
            continue
        if ch in ("'", '"'):
            in_str = True
            quote = ch
            continue
        if ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
            if depth == 0:
                end_idx = idx
                break

    if end_idx is not None:
        candidate = cleaned[start_idx:end_idx + 1]
        try:
            return json.loads(candidate)
        except Exception as err:
            print("[Groq JSON Parsing Error]", err)
    else:
        print("[Groq JSON Parsing Error] JSON structure never terminated.")
    return None


def _ai_json_call(prompt, system_prompt, temperature):
    """Calls the AI and parses its JSON output, retrying once when the response
    contains no valid JSON (transient malformed/truncated output).

    Returns the parsed JSON value (list/dict) or None. A GroqOfflineError propagates
    so callers can degrade to content-derived offline generation; other provider
    errors behave exactly as before.
    """
    for attempt in range(2):
        raw = call_groq_ai(prompt, system_prompt=system_prompt, temperature=temperature)
        parsed = _parse_json_answer(raw)
        if parsed is not None:
            return parsed
        print(f"[Groq JSON Parsing Error] Retrying request (attempt {attempt + 1}/2).")
    return None


def _sentences(text, limit=40):
    """Splits raw text into cleaned, sentence-sized units."""
    import re
    if not text:
        return []
    text = re.sub(r"\s+", " ", text or "")
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    out = []
    for part in parts:
        part = part.strip()
        if len(part) >= 6:
            out.append(part)
        if len(out) >= limit:
            break
    return out


def _topics_from_text(text, max_topics=4):
    """Heuristic topic labels: prefer heading-like lines, else sentence clusters."""
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    topics = []
    seen = set()
    for ln in lines:
        words = ln.split()
        if 1 <= len(words) <= 9 and not ln.rstrip().endswith((".", "?", "!", ";")):
            key = ln.lower()
            if key not in seen:
                topics.append(ln)
                seen.add(key)
        if len(topics) >= max_topics:
            break

    if not topics:
        sents = _sentences(text)
        size = max(1, len(sents) // max_topics)
        for i in range(max_topics):
            chunk = sents[i * size:(i + 1) * size]
            if chunk:
                head = " ".join(chunk[0].split()[:8])
                topics.append(head if head else "Core Concepts")
    return topics or ["Core Concepts"]


def _trim(text, max_len=120):
    text = (text or "").strip()
    return text if len(text) <= max_len else text[:max_len].rstrip() + "..."


_PROMPT_ACTION_WORDS = {
    "make", "create", "generate", "give", "write", "build", "prepare", "produce",
    "design", "develop", "form", "compose", "ask", "me", "quiz", "quizzes",
    "flashcards", "flashcard", "flash", "cards", "card", "summary", "summaries",
    "summarize", "summarise", "reviewer", "review", "question", "questions",
    "q", "qs", "study", "material", "notes", "list", "provide", "answers",
    "answer", "test", "exam", "practice", "about", "on", "for", "of", "from",
    "with", "topic", "topics", "a", "an", "the", "my", "your", "please",
    "some", "few", "basic", "based",
}


def _prompt_topic(text):
    """Extracts a study subject from a short prompt (e.g. 'make 20 questions
    about photosynthesis' -> 'photosynthesis', 'generate 5 questions with the
    Dota 2 topic' -> 'Dota 2') by stripping action words, standalone count
    numbers and trailing filler. Digits are kept only when they are part of a
    topic name (e.g. 'Dota 2'). Falls back to a neutral label when nothing
    remains."""
    import re
    words = (text or "").strip().split()
    kept = []
    for w in words:
        cleaned = w.strip(".,;:!?\"'()[]{}")
        lowered = cleaned.lower()
        if lowered in _PROMPT_ACTION_WORDS:
            continue
        if re.fullmatch(r"\d+", cleaned):
            if kept and not re.fullmatch(r"\d+", kept[-1]):
                kept.append(cleaned)
            continue
        kept.append(cleaned)
    while kept and kept[-1].lower() in ("topic", "topics"):
        kept.pop()
    topic = " ".join(kept).strip()
    if not topic:
        return "the requested topic"
    return _trim(topic, 60)


def _is_prompt_like(text_content):
    """True when the input is a bare instruction (e.g. 'Generate 5 questions
    with the Dota 2 topic') rather than pasted study material. Real material,
    including single-sentence notes, is never treated as a prompt."""
    text = (text_content or "").strip()
    if not text:
        return False
    if len(_sentences(text)) > 1:
        return False
    import re
    first = text.split()[0].lower().strip(".,;:!?\"'()[]{}")
    return first in _PROMPT_ACTION_WORDS or bool(re.fullmatch(r"\d+", first))


def _expand_prompt_material(text_content):
    """Expands a prompt-only input (e.g. 'make 20 questions about photosynthesis')
    into a short topic-anchored study scaffold so the offline fallback builders can
    produce varied, non-repetitive output instead of echoing the prompt. Real
    multi-sentence material is returned unchanged.

    The first line is an unpunctated heading so `_topics_from_text` labels it with
    the subject, and the following sentences direct the live AI to draw on its own
    knowledge of the topic while giving the offline builders distinct units.
    """
    if len(_sentences(text_content)) > 1:
        return text_content
    topic = _prompt_topic(text_content)
    return (
        f"{topic}\n"
        f"Topic: {topic}. Generate study material about this topic using your own knowledge of it.\n"
        f"Key focus areas: core definitions, main concepts, important terminology, key processes, and practical applications related to {topic}.\n"
        f"Cover the essential ideas a student must understand about {topic}."
    )


def _build_quiz_fallback(text_content, num_questions, difficulty, context=None):
    text_content = _expand_prompt_material(text_content)
    blooms_levels = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
    stems = [
        "Based on the material, which statement is correct?",
        "According to the material, which of the following is true?",
        "Select the accurate statement from the material.",
        "Which statement correctly reflects the material?"
    ]
    sentences = _sentences(text_content) or [_trim(text_content) or "Review the key concepts of this material."]
    topics = _topics_from_text(text_content)

    # Existing question signatures so follow-up "add more" calls produce genuinely NEW
    # items: skip any (stem, fact) pair already used, and also avoid repeating a fact that
    # was already the correct answer of an existing question.
    existing_questions = {
        str(q.get("question", "")).strip()
        for q in (context or [])
        if isinstance(q, dict)
    }
    existing_answers = set()
    for q in context or []:
        if not isinstance(q, dict):
            continue
        opts = q.get("options") or []
        ca = q.get("correctAnswer")
        if isinstance(ca, str) and ca.strip().isdigit():
            ca = int(ca.strip())
        if isinstance(ca, int) and 0 <= ca < len(opts):
            existing_answers.add(str(opts[ca]).strip())
        else:
            existing_answers.add(str(q.get("question", "")).strip())

    questions = []
    stem_i = 0
    for i in range(num_questions):
        # Shift through sentence facts; if the fact was already used as a correct answer
        # in this session, try the next sentence so "add more" yields NEW facts.
        main = None
        for shift in range(len(sentences)):
            cand = sentences[(i + shift) % len(sentences)]
            cand_text = str(cand).strip()
            if cand_text not in existing_answers:
                main = cand
                break
        if main is None:
            main = sentences[i % len(sentences)]
        main_text = str(main).strip()

        # Pick a stem that yields a question string not already generated this session.
        stem = None
        for _ in range(len(stems)):
            cand_stem = stems[stem_i % len(stems)]
            stem_i += 1
            if f"{cand_stem} {main_text}" not in existing_questions:
                stem = cand_stem
                break
        if stem is None:
            continue

        existing_questions.add(f"{stem} {main_text}")
        existing_answers.add(main_text)

        distractors = []
        for offset in range(1, len(sentences)):
            cand = sentences[(i + offset) % len(sentences)]
            if cand != main and cand not in distractors:
                distractors.append(cand)
            if len(distractors) >= 3:
                break
        while len(distractors) < 3:
            distractors.append("None of the other options accurately capture this section.")
        opt = lambda s: _trim(s, 90)
        questions.append({
            "id": f"q-{i+1}",
            "question": stem,
            "type": "multiple_choice",
            "options": [opt(main)] + [opt(d) for d in distractors],
            "correctAnswer": 0,
            "explanation": f"From the material: {_trim(main, 160)}",
            "bloomsLevel": blooms_levels[i % len(blooms_levels)],
            "difficulty": difficulty,
            "topicTag": topics[i % len(topics)]
        })
    return questions


def _build_flashcards_fallback(text_content, count, context=None):
    text_content = _expand_prompt_material(text_content)
    sentences = _sentences(text_content) or [_trim(text_content) or "Key concept to review."]
    topics = _topics_from_text(text_content)
    existing = {
        str(c.get("question", "")).strip()
        for c in (context or [])
        if isinstance(c, dict)
    }
    all_words = []
    for sent in sentences:
        for w in sent.split():
            w = w.rstrip(".,;:")
            if len(w) > 4:
                all_words.append(w)
    if not all_words:
        all_words = ["key concept"]
    cards = []
    for i in range(count):
        sent = sentences[i % len(sentences)]
        top = topics[i % len(topics)]
        # Pick the first not-yet-used significant word so follow-up "add more" calls
        # produce NEW cards instead of re-emitting the same ones.
        q_word = None
        for shift in range(len(all_words)):
            cand = all_words[(i + shift) % len(all_words)]
            cand_q = f"Define or explain: {cand}"
            if cand_q not in existing:
                q_word = cand
                break
        if q_word is None:
            q_word = all_words[i % len(all_words)]
        q_text = f"Define or explain: {q_word}"
        existing.add(q_text)
        cards.append({
            "id": f"fc-{i+1}",
            "question": q_text,
            "answer": _trim(sent, 140),
            "topicTag": top,
            "difficulty": "medium"
        })
    return cards


def _build_summary_fallback(text_content):
    """Content-derived extractive summary.

    Scores each sentence by significant-word frequency plus a position bonus, then
    selects the highest-scoring sentences for the executive summary, key takeaways,
    and bullet points. This produces a condensed summary rather than echoing the
    raw opening sentences verbatim.
    """
    import re

    text_content = _expand_prompt_material(text_content)
    sentences = _sentences(text_content) or [_trim(text_content, 200) or "The material covers key concepts for this subject."]

    if len(sentences) == 1:
        first = sentences[0]
        return {
            "executiveSummary": _trim(first, 400),
            "keyTakeaways": [_trim(first, 140)],
            "bulletPoints": [_trim(first, 120)],
        }

    STOPWORDS = set(
        "the a an and or but if then for of to in on at by with from as is are was were be been "
        "being this that these those it its not no so such than too very can could will would should "
        "may might have has had do does did"
        .split()
    )

    sentence_words = []
    for s in sentences:
        words = [w.lower() for w in re.findall(r"[A-Za-z][A-Za-z'-]*", s)]
        sentence_words.append(words)

    word_freq = {}
    for words in sentence_words:
        for w in words:
            if w not in STOPWORDS and len(w) > 2:
                word_freq[w] = word_freq.get(w, 0) + 1

    scored = []
    n = max(1, len(sentences) - 1)
    for idx, words in enumerate(sentence_words):
        score = sum(word_freq.get(w, 0) for w in words if w not in STOPWORDS and len(w) > 2)
        score *= 1.0 + 0.4 * (1.0 - idx / n)
        scored.append((score, idx))

    ranked = sorted(scored, key=lambda x: (-x[0], x[1]))

    summary_idx = sorted(idx for _, idx in ranked[:4])
    executive = _trim(" ".join(sentences[i] for i in summary_idx), 500)

    takeaway_idx = [idx for _, idx in ranked[4:9]]
    takeaways = [_trim(sentences[i], 140) for i in takeaway_idx]

    bullet_idx = [idx for _, idx in ranked[9:17]]
    bullets = [_trim(sentences[i], 120) for i in bullet_idx]

    if not takeaways:
        takeaways = [_trim(executive, 140)]
    if not bullets:
        bullets = [_trim(sentences[i], 120) for i in summary_idx[:3]]

    return {
        "executiveSummary": executive,
        "keyTakeaways": takeaways,
        "bulletPoints": bullets,
    }


def _build_reviewer_fallback(text_content):
    text_content = _expand_prompt_material(text_content)
    sentences = _sentences(text_content) or ["Review the core concepts and key definitions of this material."]
    topics = _topics_from_text(text_content)

    if len(topics) == 1 and len(sentences) > 4:
        size = max(1, len(sentences) // 2)
        topics = topics + ["Study Application"]

    n = max(1, len(topics))
    size = max(1, len(sentences) // n)
    reviewer_topics = []
    for idx, topic in enumerate(topics[:n]):
        chunk = sentences[idx * size:(idx + 1) * size]
        chunk = chunk or sentences[-1:]
        chunk_text = " ".join(chunk)
        concepts = []
        for s in chunk:
            frag = s.split(". ")[0].strip()
            if frag and frag not in concepts and len(frag) <= 90:
                concepts.append(frag)
            if len(concepts) >= 3:
                break
        if not concepts:
            concepts = [_trim(chunk_text, 90)]
        sample_questions = []
        for s in chunk[:2]:
            sample_questions.append({
                "question": f"Summarize the main idea of: {_trim(s, 90)}",
                "answer": _trim(s, 140)
            })
        if not sample_questions:
            sample_questions = [{
                "question": f"What are the key points of {topic}?",
                "answer": _trim(chunk_text, 140)
            }]
        reviewer_topics.append({
            "topic": topic,
            "overview": _trim(chunk_text, 200),
            "keyConcepts": concepts,
            "sampleQuestions": sample_questions
        })
    return {
        "overview": _trim(" ".join(sentences[:2]) + ("..." if len(sentences) > 2 else ""), 240),
        "topics": reviewer_topics
    }


def _chunk_text(text_content: str, max_chars: int = 4000) -> list:
    """Splits long study material into semantic chunks at paragraph/sentence boundaries.

    Short documents return a single chunk. Long documents are split greedily along
    paragraph breaks first (falling back to sentence breaks) so every chunk stays
    under ``max_chars`` while preserving readable, self-contained sections.
    """
    import re
    text = (text_content or "").strip()
    if not text:
        return [""]
    if len(text) <= max_chars:
        return [text]

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks = []
    current = ""

    def push(chunk):
        nonlocal current
        if chunk.strip():
            chunks.append(chunk.strip())

    for para in paragraphs:
        while len(para) > max_chars:
            if current:
                push(current)
                current = ""
            sentences = re.split(r"(?<=[.!?])\s+", para)
            buffer = ""
            for sent in sentences:
                if len(buffer) + len(sent) + 1 > max_chars and buffer:
                    push(buffer)
                    buffer = sent
                else:
                    buffer = (buffer + " " + sent).strip()
            para = buffer
        if not para:
            continue
        if current and len(current) + len(para) + 2 > max_chars:
            push(current)
            current = para
        else:
            current = (current + "\n\n" + para).strip()

    push(current)
    return chunks or [text[:max_chars]]


def _generation_chunks(text_content: str, max_chars: int = 4000) -> list:
    """Returns the chunk list to feed per-section AI generation. Never empty."""
    return _chunk_text(text_content, max_chars) or [text_content or ""]

def _instruction_directive(instructions: str = "") -> str:
    """Builds the user-instruction block injected into generation prompts.

    When the user gives instructions, the AI analyzes them and shapes topics,
    question style, difficulty mix, and emphasis accordingly — instead of
    producing generic content only from the material text.
    """
    instructions = (instructions or "").strip()
    if not instructions:
        return ""
    return (
        "\n\nUSER INSTRUCTIONS (follow these strictly):\n"
        f"{instructions}\n"
        "Analyze this instruction and shape the output accordingly: choose relevant topics, "
        "question style, difficulty mix, and emphasis based on what is instructed, "
        "while still grounding everything in the material text below."
    )

def _randomize_mc_correct_answer(questions: list) -> list:
    """Shuffles the option order of every multiple-choice question and re-points the
    correct answer to wherever the correct option moved. This removes the common
    "all correct answers in position A" bias from both AI and fallback generation.
    """
    if not isinstance(questions, list):
        return questions
    for q in questions:
        if not isinstance(q, dict):
            continue
        if q.get("type") != "multiple_choice":
            continue
        options = q.get("options")
        if not isinstance(options, list) or len(options) < 2:
            continue
        correct = q.get("correctAnswer")
        if isinstance(correct, str) and correct.strip().isdigit():
            correct = int(correct.strip())
        if not isinstance(correct, int) or not (0 <= correct < len(options)):
            correct = 0
        correct_text = options[correct]
        shuffled = list(options)
        random.shuffle(shuffled)
        q["options"] = shuffled
        q["correctAnswer"] = shuffled.index(correct_text)
    return questions


def _merge_context_and_new(context, new_items, id_prefix):
    """Combines previously generated items (context) with freshly generated ones,
    tagging the new items with ``isNew`` and re-indexing stable ids. Used for
    continuous-session generation (e.g. "add 5 more" extends the prior questions)."""
    combined = list(context or []) + list(new_items or [])
    for idx, item in enumerate(combined):
        if isinstance(item, dict):
            item["id"] = f"{id_prefix}-{idx + 1}"
            # Old items must never stay flagged as "new" across turns, otherwise every
            # "add more" incorrectly marks the whole accumulated set as newly added.
            item["isNew"] = False
    for item in new_items or []:
        if isinstance(item, dict):
            item["isNew"] = True
    return combined


def _context_existing_block(context, label):
    """Builds the 'EXISTING ITEMS' section appended to generation prompts so the AI
    knows what was already generated and avoids duplicating it."""
    if not context:
        return ""
    # Compact the existing items to just their essential text so follow-up prompts stay
    # small (full JSON with options/answers/explanations bloats the prompt, exhausting the
    # free-tier TPM budget faster and triggering rate-limit waits). The AI only needs to
    # know WHAT was already generated to avoid duplicating it.
    lines = []
    for item in context:
        if not isinstance(item, dict):
            continue
        text = str(item.get("question") or "").strip()
        if not text:
            continue
        tag = str(item.get("topicTag") or "").strip()
        lines.append(f"{len(lines) + 1}. {text}" + (f" [topic: {tag}]" if tag else ""))
    if not lines:
        return ""
    return (
        f"\nEXISTING {label} ALREADY GENERATED IN THIS SESSION "
        "(generate NEW, different ones \u2014 do NOT repeat or duplicate these):\n"
        + "\n".join(lines)
        + "\n"
    )


def generate_quiz_with_groq(text_content: str, num_questions: int = 5, difficulty: str = "medium", instructions: str = "", context: list = None) -> list:
    """
    Generates structured assessment questions classified strictly into Bloom's Taxonomy 6 cognitive levels:

    - Remembering, Understanding, Applying, Analyzing, Evaluating, Creating

    When ``context`` (previously generated questions) is supplied, only NEW non-duplicate
    questions are generated and the combined set is returned with the new ones flagged.
    """
    blooms_levels = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
    context = context or []

    try:
        num_questions = int(num_questions)
    except (TypeError, ValueError):
        num_questions = 5
    num_questions = max(1, min(MAX_AI_QUESTIONS, num_questions))

    if _is_prompt_like(text_content):
        text_content = _expand_prompt_material(text_content)

    system_prompt = (
        "You are StudyLens AI Assessment Generator powered by Groq Inference (GPT-OSS-120B). "
        "Generate a valid JSON array of quiz questions strictly adhering to this JSON format:\n"
        "[\n"
        "  {\n"
        '    "id": "q1",\n'
        '    "question": "Question text here?",\n'
        '    "type": "multiple_choice",\n'
        '    "options": ["Option A", "Option B", "Option C", "Option D"],\n'
        '    "correctAnswer": 0,\n'
        '    "explanation": "Detailed explanation of correct answer",\n'
        '    "bloomsLevel": "Understanding",\n'
        '    "difficulty": "medium",\n'
        '    "topicTag": "Topic Name"\n'
        "  }\n"
        "]"
    )

    chunks = _generation_chunks(text_content, 4000)
    existing_block = _context_existing_block(context, "QUESTIONS")

    questions = []
    request_no = 0
    rounds = 0
    while len(questions) < num_questions and rounds < MAX_BATCH_ROUNDS:
        rounds += 1
        added = False
        for chunk in chunks:
            if len(questions) >= num_questions:
                break
            need = min(MAX_PER_CHUNK, num_questions - len(questions))
            request_no += 1
            gen_line = (
                f"Generate {need} NEW additional high-quality adaptive assessment questions based on the following material.\n"
                if existing_block
                else f"Generate {need} high-quality adaptive assessment questions based on the following material.\n"
            )
            prompt = (
                gen_line
                + f"Ensure questions cover Bloom's 6 cognitive levels: Remembering, Understanding, Applying, Analyzing, Evaluating, Creating.\n"
                f"Target Difficulty: {difficulty}\n"
                f"The material below is the PRIMARY source. Use this entire section and generate every question strictly from its own concepts.\n"
                "OPTION RULES (strict):\n"
                "- Every option must be SHORT (roughly 1 to 8 words), self-contained, and distinct — a plausible answer phrase, never a quoted paragraph or full sentence copied from the document.\n"
                "- NEVER copy a document sentence verbatim, and NEVER truncate an option with '...'.\n"
                "- Keep the three wrong options the same KIND of answer as the correct one (all short facts, all short terms, etc.) so the question is genuinely discriminating.\n"
                '- "correctAnswer" must be the index of the exactly-correct option; make sure only ONE option is correct.\n'
                "- Vary the correct answer position across questions (mix indices 0, 1, 2, 3) — never always place the correct option first.\n"
                '- The "explanation" must explain the concept in your OWN words and may briefly cite the material; do not start it with "From the material:" quoting a full sentence.\n'
                f"{_instruction_directive(instructions)}"
                f"{existing_block}"
                f"\nMaterial Text (request {request_no}):\n{chunk}\n\n"
                "Return ONLY raw valid JSON array."
            )
            if request_no > 1:
                time.sleep(BATCH_CALL_PACING_SECONDS)
            try:
                parsed = _ai_json_call(prompt, system_prompt=system_prompt, temperature=0.5)
            except GroqOfflineError as e:
                mark_offline_fallback(e.code or "OFFLINE_USED")
                fallback_new = _build_quiz_fallback(text_content, num_questions, difficulty, context)
                return _randomize_mc_correct_answer(_merge_context_and_new(context, fallback_new, "q"))
            if isinstance(parsed, list) and parsed:
                questions.extend(parsed)
                added = True
        if not added:
            break

    if len(questions) >= 1:
        return _randomize_mc_correct_answer(_merge_context_and_new(context, questions[:num_questions], "q"))

    # Degrade to content-derived questions grounded in the actual material.
    print("[Groq Quiz] Falling back to content-derived question generation.")
    mark_offline_fallback()
    fallback_new = _build_quiz_fallback(text_content, num_questions, difficulty, context)
    return _randomize_mc_correct_answer(_merge_context_and_new(context, fallback_new, "q"))


def generate_flashcards_with_groq(text_content: str, count: int = 5, instructions: str = "", context: list = None) -> list:
    system_prompt = (
        "You are StudyLens AI Flashcard Generator powered by Groq Inference (GPT-OSS-120B). "
        "Return a raw JSON array of objects with keys: id, question, answer, topicTag, difficulty."
    )
    context = context or []

    try:
        count = int(count)
    except (TypeError, ValueError):
        count = 5
    count = max(1, min(MAX_AI_FLASHCARDS, count))

    if _is_prompt_like(text_content):
        text_content = _expand_prompt_material(text_content)

    chunks = _generation_chunks(text_content, 3500)
    existing_block = _context_existing_block(context, "FLASHCARDS")

    cards = []
    request_no = 0
    rounds = 0
    while len(cards) < count and rounds < MAX_BATCH_ROUNDS:
        rounds += 1
        added = False
        for chunk in chunks:
            if len(cards) >= count:
                break
            need = min(MAX_PER_CHUNK, count - len(cards))
            request_no += 1
            gen_line = (
                f"Create {need} NEW additional concise active-recall flashcards from this text section. "
                if existing_block
                else f"Create {need} concise active-recall flashcards from this text section. "
            )
            prompt = (
                f"{gen_line}Use this entire section and base every card only on its concepts:"
                f"{_instruction_directive(instructions)}"
                f"{existing_block}"
                f"\n\nMaterial Text (request {request_no}):\n{chunk}"
            )
            if request_no > 1:
                time.sleep(BATCH_CALL_PACING_SECONDS)
            try:
                parsed = _ai_json_call(prompt, system_prompt=system_prompt, temperature=0.6)
            except GroqOfflineError as e:
                mark_offline_fallback(e.code or "OFFLINE_USED")
                return _merge_context_and_new(context, _build_flashcards_fallback(text_content, count, context), "fc")
            if isinstance(parsed, list) and parsed:
                cards.extend(parsed)
                added = True
        if not added:
            break

    if len(cards) >= 1:
        return _merge_context_and_new(context, cards[:count], "fc")

    print("[Groq Flashcards] Falling back to content-derived flashcard generation.")
    mark_offline_fallback()
    return _merge_context_and_new(context, _build_flashcards_fallback(text_content, count, context), "fc")


def generate_summary_with_groq(text_content: str, instructions: str = "") -> dict:
    system_prompt = (
        "You are StudyLens AI Document Summarizer powered by Groq Inference (GPT-OSS-120B). "
        'Return valid JSON with exactly these keys: "executiveSummary" (string of 3-6 sentences), '
        '"keyTakeaways" (array of 4-8 short paraphrased phrases), "bulletPoints" (array of 6-10 short bullet strings). '
        "Condense and paraphrase in your OWN words; do not echo sentences from the material verbatim. "
        "Ground every takeaway and bullet in the definitions and conclusions found in the section."
    )

    if _is_prompt_like(text_content):
        text_content = _expand_prompt_material(text_content)

    chunks = _generation_chunks(text_content, 4000)
    summaries = []
    for chunk in chunks:
        prompt = f"Read this whole study material section, then write: (1) a concise executiveSummary of its main idea and definitions in 3-6 sentences, (2) keyTakeaways as short paraphrased phrases, (3) bulletPoints as short bullets. Do not copy sentences from the material verbatim. Capture definitions and key conclusions:{_instruction_directive(instructions)}\n\nMaterial Text (section {len(summaries) + 1} of {len(chunks)}):\n{chunk}"
        try:
            parsed = _ai_json_call(prompt, system_prompt=system_prompt, temperature=0.5)
        except GroqOfflineError as e:
            mark_offline_fallback(e.code or "OFFLINE_USED")
            return _build_summary_fallback(text_content)
        if isinstance(parsed, dict) and parsed.get("executiveSummary"):
            summaries.append(parsed)

    if summaries:
        if len(summaries) == 1:
            return summaries[0]
        key_takeaways = []
        bullet_points = []
        for s in summaries:
            key_takeaways.extend(s.get("keyTakeaways", [])[:4])
            bullet_points.extend(s.get("bulletPoints", [])[:6])
        return {
            "executiveSummary": _trim(" ".join(s.get("executiveSummary", "") for s in summaries), 600),
            "keyTakeaways": [str(t) for t in key_takeaways[:8]],
            "bulletPoints": [str(b) for b in bullet_points[:12]],
        }

    print("[Groq Summary] Falling back to content-derived summary generation.")
    mark_offline_fallback()
    return _build_summary_fallback(text_content)


def generate_reviewer_with_groq(text_content: str, instructions: str = "") -> dict:
    """Builds a topic-by-topic study reviewer: overview + structured topics."""
    system_prompt = (
        "You are StudyLens AI Reviewer Generator powered by Groq Inference (GPT-OSS-120B). "
        "Return valid JSON with keys: overview (string), topics (array). "
        'Each topic object must have keys: "topic" (string), "overview" (string), '
        '"keyConcepts" (array of string), "sampleQuestions" (array of objects). '
        'Each sampleQuestions item must have keys "question" (string) and "answer" (string).'
    )

    if _is_prompt_like(text_content):
        text_content = _expand_prompt_material(text_content)

    chunks = _generation_chunks(text_content, 4000)
    reviewers = []
    for chunk in chunks:
        prompt = f"Create a study reviewer for this material section: a concept overview and topic-by-topic breakdown. Use this entire section and ground every topic in its own content:{_instruction_directive(instructions)}\n\nMaterial Text (section {len(reviewers) + 1} of {len(chunks)}):\n{chunk}"
        try:
            parsed = _ai_json_call(prompt, system_prompt=system_prompt, temperature=0.5)
        except GroqOfflineError as e:
            mark_offline_fallback(e.code or "OFFLINE_USED")
            return _build_reviewer_fallback(text_content)
        if isinstance(parsed, dict) and parsed.get("overview") and isinstance(parsed.get("topics"), list):
            for topic in parsed["topics"]:
                topic["sampleQuestions"] = [
                    sq if isinstance(sq, dict) else {"question": sq, "answer": ""}
                    for sq in (topic.get("sampleQuestions") or [])
                ]
            reviewers.append(parsed)

    if reviewers:
        if len(reviewers) == 1:
            return reviewers[0]
        topics = []
        for r in reviewers:
            topics.extend(r.get("topics", []))
        return {
            "overview": _trim(" ".join(r.get("overview", "") for r in reviewers), 600),
            "topics": topics,
        }

    print("[Groq Reviewer] Falling back to content-derived reviewer generation.")
    mark_offline_fallback()
    return _build_reviewer_fallback(text_content)


def explain_answer_with_groq(question: str, options: list, correct_index: int, selected_index: int, text_context: str = "") -> dict:
    """Explains a quiz item in plain language for a student."""
    system_prompt = (
        "You are StudyLens AI Answer Explainer powered by Groq Inference (GPT-OSS-120B). "
        "Return valid JSON with keys: explanation (string), conceptHint (string), reviewTip (string)."
    )
    prompt = (
        "Explain this assessment item in a study-friendly way.\n"
        f"Question: {question}\n"
        f"Options: {json.dumps(options)}\n"
        f"Correct answer index: {correct_index}\n"
        f"Student selected index: {selected_index}\n"
        f"Source material context:\n{text_context[:2000]}\n"
        "Return ONLY the JSON object."
    )

    try:
        raw = call_groq_ai(prompt, system_prompt=system_prompt, temperature=0.3)
    except GroqOfflineError as e:
        mark_offline_fallback(e.code or "OFFLINE_USED")
        raw = ""
    parsed = _parse_json_answer(raw)
    if isinstance(parsed, dict) and parsed.get("explanation"):
        return parsed

    correct_text = ""
    if isinstance(options, list) and 0 <= correct_index < len(options):
        correct_text = str(options[correct_index])

    return {
        "explanation": (
            f"The correct answer is {correct_text or 'the option highlighted as correct'}. "
            "Compare the details of your selection against the definition to see the difference."
        ),
        "conceptHint": "Focus on how the correct option aligns with the core definition of the topic.",
        "reviewTip": "Re-read the study material section covering this topic, then retry a similar question."
    }


def generate_hint_with_groq(question: str, options: list) -> str:
    """Generates a subtle 1-2 sentence educational hint for a quiz question.

    Never raises: on any failure (offline, rate limited, invalid response) it returns
    a generic study hint so the student-facing UI always has something useful.
    """
    question = str(question or "").strip()
    if not question:
        return "Review the core definitions and key terms covered in this topic."

    system_prompt = (
        "You are StudyLens AI Hint Assistant powered by Groq Inference (GPT-OSS-120B). "
        "Give a subtle, helpful 1-2 sentence educational hint without revealing the correct answer."
    )
    prompt = (
        "Provide a subtle, helpful 1-2 sentence educational hint for this question "
        "without directly revealing which option is correct:\n"
        f"Question: {question}\n"
        f"{('Options: ' + json.dumps(options)) if isinstance(options, list) and options else ''}"
    )

    try:
        raw = call_groq_ai(prompt, system_prompt=system_prompt, temperature=0.4)
    except GroqOfflineError as e:
        mark_offline_fallback(e.code or "OFFLINE_USED")
        return "Focus on the core definitions and key concepts involved in this question."
    except GroqAPIError:
        return "Focus on the core definitions and key concepts involved in this question."

    hint = str(raw or "").strip().strip('"')
    if hint:
        return hint[:300]
    return "Focus on the core definitions and key concepts involved in this question."


def generate_recommendations_with_groq(profile: dict) -> dict:
    """Personalized learning recommendations generated from a student performance profile."""
    system_prompt = (
        "You are StudyLens AI Personalized Learning Advisor powered by Groq Inference (GPT-OSS-120B). "
        "Return valid JSON with keys: summary (string), recommendations (array), nextSteps (array). "
        "Each recommendation object must have keys: area (string), reason (string), action (string), resource (string)."
    )
    prompt = (
        "Generate personalized learning recommendations from this student profile (JSON):\n"
        f"{json.dumps(profile)}\n"
        "Return ONLY the JSON object."
    )

    try:
        raw = call_groq_ai(prompt, system_prompt=system_prompt, temperature=0.5)
    except GroqOfflineError as e:
        mark_offline_fallback(e.code or "OFFLINE_USED")
        raw = ""
    parsed = _parse_json_answer(raw)
    if isinstance(parsed, dict) and "recommendations" in parsed:
        return parsed

    weak = profile.get("weakTopics") or []
    strong = profile.get("strongTopics") or []
    area = ", ".join(weak[:3]) if isinstance(weak, list) and weak else "Underperforming topics"
    strengths = ", ".join(strong[:3]) if isinstance(strong, list) and strong else "your strong areas"

    return {
        "summary": f"Your current average is {profile.get('averageScore', 'N/A')}%. Prioritize practice on {area} while using {strengths} to build confidence.",
        "recommendations": [
            {
                "area": area,
                "reason": "Low recent performance identified from quiz analytics.",
                "action": "Complete one targeted practice quiz and review the related flashcard deck.",
                "resource": "AI-generated quizzes and flashcards for the material."
            }
        ],
        "nextSteps": [
            "Retake a practice quiz after reviewing the material.",
            "Use flashcards for spaced repetition of key terms."
        ]
    }


def _extract_title_from_raw(raw):
    """Extracts a title value from a non-JSON AI response using regex, tolerating
    both quoted values and unquoted values (e.g. `{"title": Algorithm Quiz Study
    Guide}`). Returns "" when no usable title is found."""
    import re
    text = raw or ""
    m = re.search(r'"title"\s*:\s*"([^"]*)"', text)
    if m:
        return m.group(1).strip()
    m = re.search(r'"title"\s*:\s*([^,}\]]+)', text)
    if m:
        return m.group(1).strip(' ".\'')
    return ""


def generate_title_with_groq(kind: str, generated_content) -> str:
    """Returns a short AI-chosen title describing what the generated content is about.

    Never raises and never marks the offline-fallback flag (the generated content itself
    may have come from the live AI; a title failure should not degrade that notice). On any
    failure — offline, parse error, empty, too long — it returns "" so the caller can fall
    back to a source-text-derived title.
    """
    import re

    preview = ""
    try:
        if isinstance(generated_content, dict):
            if kind == "summary":
                preview = " ".join(
                    str(generated_content.get("executiveSummary", ""))[:400],
                    " ".join(str(t) for t in generated_content.get("keyTakeaways", [])[:4])[:300],
                )
            elif kind == "reviewer":
                preview = " ".join(
                    str(generated_content.get("overview", ""))[:400],
                    ", ".join(str(t.get("topic", "")) for t in generated_content.get("topics", [])[:6])[:300],
                )
            else:
                preview = json.dumps(generated_content)[:600]
        else:
            preview = str(generated_content)[:600]
    except Exception:
        preview = str(generated_content)[:600]

    if not preview or not preview.strip():
        return ""

    kind_label = {
        "quiz": "assessment quiz",
        "flashcards": "flashcard deck",
        "summary": "study summary",
        "reviewer": "study reviewer",
    }.get(kind, "study resource")

    system_prompt = (
        "You are StudyLens AI Title Generator powered by Groq Inference (GPT-OSS-120B). "
        'Return ONLY raw JSON with a single key "title" containing ONE short, descriptive '
        "title (5-8 words) for a study resource. Do not use quotes, code, or markdown in the title."
    )
    prompt = (
        f"Write a short, descriptive title for this generated {kind_label} based ONLY on what the content is about.\n"
        f"Generated content preview:\n{preview}\n"
        'Return ONLY raw JSON: {"title": "..."}'
    )

    try:
        raw = call_groq_ai(prompt, system_prompt=system_prompt, temperature=0.4)
    except Exception:
        return _local_title_from_content(kind, preview)

    parsed = _parse_json_answer(raw)
    if isinstance(parsed, dict):
        title = str(parsed.get("title", "") or "").strip()
    else:
        title = _extract_title_from_raw(raw)
        if not title:
            title = str(raw or "").strip().strip('"').strip()

    title = re.sub(r"\s+", " ", title).strip(' ".\'')
    if title and len(title) <= 80:
        return title
    return _local_title_from_content(kind, preview)


_STOPWORDS = frozenset(
    """
    the a an and or but for with this that these those is are was were be been being
    of in on at to from by about into through during before after above below between
    out off over under again further then once here there when where why how all any
    both each few more most other some such no nor not only own same so than too very
    can will just should now using used use may might must shall have has had having
    do does did doing what which who whom whose its it's don't about across along
    """.split()
)


def _local_title_from_content(kind: str, preview: str) -> str:
    """Builds a short title from the most frequent meaningful words in the content.

    Used only when the live Groq title call fails or returns nothing, so the UI still
    shows a descriptive title instead of a raw content preview.
    """
    import re

    words = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", (preview or "").lower())
    freqs: dict[str, int] = {}
    for w in words:
        if w in _STOPWORDS or len(w) < 3:
            continue
        freqs[w] = freqs.get(w, 0) + 1
    top = [w for w, _ in sorted(freqs.items(), key=lambda kv: (-kv[1], kv[0]))[:4]]
    if not top:
        return ""

    words_cap = " ".join(w.capitalize() for w in top)
    prefix = {
        "quiz": "Assessment",
        "flashcards": "Flashcards",
        "summary": "Summary",
        "reviewer": "Reviewer",
    }.get(kind, "Study")
    return f"{prefix}: {words_cap}"