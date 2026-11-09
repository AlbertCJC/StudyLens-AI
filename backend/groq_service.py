import os
import json
import random
import re
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
MAX_RATE_LIMIT_RETRIES = 2
RATE_LIMIT_BACKOFF_BASE = 2.0
RATE_LIMIT_BACKOFF_CAP = 8.0
# Clamp any provider Retry-After header to this many seconds so a large free-tier TPM
# reset window (often 30-60s) never turns a single call into a multi-minute hang.
RATE_LIMIT_RETRY_AFTER_MAX = 4


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
# Safety ceiling on batching rounds (typical 5-10 questions need 1-2 rounds; 4 leaves
# headroom without stalling the user waiting on repeated AI calls).
MAX_BATCH_ROUNDS = 4

# Pacing delay inserted between consecutive AI calls inside a batched generation so a
# large request (e.g. "add 20 more") doesn't burst several requests into the same free-tier
# rate-limit window right after the previous generation.
BATCH_CALL_PACING_SECONDS = 0.5

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


def _build_identification_questions(text_content, count, context=None):
    """Content-derived identification questions: each as a material sentence that the
    learner must recognize a specific term/concept from. The correct answer is a concise
    key term drawn from the same sentence, so it reads like an authentic identification item."""
    import re
    text_content = _expand_prompt_material(text_content)
    sentences = _sentences(text_content) or [_trim(text_content) or "Core Concepts"]
    topics = _topics_from_text(text_content)
    blooms_levels = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
    existing = {
        str(q.get("question", "")).strip()
        for q in (context or [])
        if isinstance(q, dict)
    }
    existing_answers = {
        str(q.get("correctAnswer", "")).strip().lower()
        for q in (context or [])
        if isinstance(q, dict) and str(q.get("type", "")).strip() == "identification"
    }
    stops = {"about", "above", "after", "again", "between", "because", "could", "have", "from",
             "their", "there", "these", "those", "through", "under", "which", "whereas", "whereas",
             "without", "would", "should", "shall", "might", "being", "been", "were", "with"}
    questions = []
    for i in range(count):
        sent = sentences[i % len(sentences)]
        top = topics[i % len(topics)]
        words = re.findall(r"[A-Za-z][A-Za-z'-]+", sent)
        term = None
        for w in words:
            clean = w.strip("'").strip("-_")
            if len(clean) >= 6 and clean.lower() not in stops:
                term = clean
                break
        if term is None and words:
            term = max(words, key=len).strip("'").strip("-_")
        if term is None and top.split():
            term = top.split()[0].strip(".,;:")
        if term is None:
            term = "key concept"
        base = term
        suffix = 2
        while term.lower() in existing_answers and suffix <= 10:
            term = f"{base} {suffix}"
            suffix += 1
        existing_answers.add(term.lower())
        q_text = f"Identify the term or concept described by this statement: {_trim(sent, 140)}"
        if q_text in existing:
            q_text = f"What key term is being defined or described in this statement? {_trim(sent, 140)}"
        existing.add(q_text)
        questions.append({
            "id": f"q-id-{i + 1}",
            "question": q_text,
            "type": "identification",
            "options": [],
            "correctAnswer": term,
            "explanation": f"From the material: {_trim(sent, 160)}",
            "bloomsLevel": blooms_levels[i % len(blooms_levels)],
            "difficulty": "medium",
            "topicTag": top
        })
    return questions


def _build_true_false_questions(text_content, count, context=None):
    """Content-derived true/false questions.

    Every other item is a statement made FALSE by swapping a key term with a different
    key term taken from another material sentence (so the answer is genuinely False); the
    rest are verbatim material statements (genuinely True). When no safe swap exists the
    statement stays True rather than risking a mislabeled answer."""
    import re
    text_content = _expand_prompt_material(text_content)
    sentences = _sentences(text_content) or [_trim(text_content) or "Key concept."]
    topics = _topics_from_text(text_content)
    blooms_levels = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
    existing = {
        str(q.get("question", "")).strip()
        for q in (context or [])
        if isinstance(q, dict)
    }

    def key_word(sent):
        m = re.search(r"\b([A-Za-z][A-Za-z']{5,})\b", sent)
        return m.group(1).strip("'") if m else None

    def swapped(sent, donor):
        w = key_word(sent)
        o = key_word(donor)
        if w and o and w.lower() != o.lower():
            return re.sub(rf"\b{re.escape(w)}\b", o, sent, count=1)
        return None

    questions = []
    for i in range(count):
        sent = sentences[i % len(sentences)]
        top = topics[i % len(topics)]
        false_variant = None
        if i % 2 == 1:
            for shift in range(1, len(sentences) + 1):
                cand = swapped(sent, sentences[(i + shift) % len(sentences)])
                if cand and cand.strip() != sent.strip():
                    false_variant = cand
                    break
        if false_variant is None:
            stmt, is_true = sent, True
        else:
            stmt, is_true = false_variant, False
        q_text = f"True or False: {_trim(stmt, 200)}"
        if q_text in existing:
            q_text = f"TRUE or FALSE: {_trim(stmt, 200)}"
        existing.add(q_text)
        questions.append({
            "id": f"q-tf-{i + 1}",
            "question": q_text,
            "type": "true_false",
            "options": ["True", "False"],
            "correctAnswer": 0 if is_true else 1,
            "explanation": (
                f"Based on the material: {_trim(sent, 160)}"
                if is_true
                else f"The statement is false. The material states: {_trim(sent, 160)}"
            ),
            "bloomsLevel": blooms_levels[i % len(blooms_levels)],
            "difficulty": "medium",
            "topicTag": top
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
        "Apply this instruction ONLY to question style, difficulty mix, emphasis, and how many "
        "questions of each format to make. Do NOT let it introduce concepts, examples, or topics "
        "outside the material text below — every question must stay on the material's actual subject. "
        "The format names (multiple choice, identification, true or false) describe the FORMAT, not the subject."
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


_QUIZ_TYPE_ALIASES = {
    "identification": "identification",
    "identifications": "identification",
    "identify": "identification",
    "multiple choice": "multiple_choice",
    "multiple-choice": "multiple_choice",
    "true or false": "true_false",
    "true and false": "true_false",
    "true/false": "true_false",
    "true false": "true_false",
    "true_false": "true_false",
    "truefalse": "true_false",
}

_QUIZ_TYPE_RE = re.compile(
    r"(\d+)?\s*"
    r"((?:identification(?:s)?|identify)|(?:multiple[\s-]choice)|(?:true[\s_/]*(?:or|and)?[\s_/]*false))",
    re.IGNORECASE,
)


def _parse_quiz_types(text):
    """Detects which question formats a user asked for inside a prompt.

    Returns ``(ordered_types, counts)`` where:
      - ``ordered_types`` is a list of ``multiple_choice`` / ``identification`` /
        ``true_false`` in the order they first appear in the text, and
      - ``counts`` maps a type to the explicit number that appeared before it
        (first occurrence wins).

    Returns ``(None, None)`` when no formats are named so callers keep the default
    all-multiple-choice behavior.
    """
    if not (text or "").strip():
        return None, None
    ordered = []
    counts = {}
    for m in _QUIZ_TYPE_RE.finditer(text):
        token = (m.group(2) or "").strip().lower()
        qtype = _QUIZ_TYPE_ALIASES.get(token)
        if qtype is None:
            continue
        if qtype not in ordered:
            ordered.append(qtype)
        if m.group(1) is not None and qtype not in counts:
            try:
                counts[qtype] = max(1, int(m.group(1)))
            except (TypeError, ValueError):
                pass
    return (ordered, counts) if ordered else (None, None)


_OVERALL_COUNT_RE = re.compile(r"(\d{1,3})\s*(?:questions?|items?|problems?|quiz|tests?)\b", re.IGNORECASE)

DEFAULT_PER_FORMAT = 5


def _extract_overall_count(text):
    """Returns the first standalone overall count like "20 questions" in ``text``,
    or None when no such phrase is present."""
    if not (text or "").strip():
        return None
    m = _OVERALL_COUNT_RE.search(text)
    if not m:
        return None
    try:
        return max(1, int(m.group(1)))
    except (TypeError, ValueError):
        return None


def _clamp_plan_total(plan, maximum):
    """Scales a plan down proportionally so its total never exceeds ``maximum``."""
    total = sum(plan.values())
    if total <= maximum:
        return plan
    weights = plan
    raw = {t: weights[t] * maximum / float(total) for t in plan}
    out = {t: int(raw[t]) for t in plan}
    remaining = maximum - sum(out.values())
    for t in sorted(plan, key=lambda x: raw[x] - float(out[x]), reverse=True):
        if remaining <= 0:
            break
        out[t] += 1
        remaining -= 1
    return {t: c for t, c in out.items() if c > 0}


def _resolve_quiz_plan(ordered_types, counts=None, overall_count=None):
    """Determines exactly how many questions of each requested format to generate.

    The prompt (or, on mobile, the source text) is the single source of truth:

      1. Formats named with an explicit count keep that count exactly; formats named
         without a number default to ``DEFAULT_PER_FORMAT`` (5 each).
      2. Otherwise, an overall total like "20 questions" is split evenly across the
         named formats using the largest-remainder method.
      3. Otherwise every named format defaults to ``DEFAULT_PER_FORMAT`` (5).

    A request whose total exceeds ``MAX_AI_QUESTIONS`` raises
    ``GroqAPIError("COUNT_EXCEEDS_MAX")`` so the caller can tell the user the maximum
    instead of silently generating fewer questions than requested.
    """
    if not ordered_types:
        return None
    counts = counts or {}
    explicit = {}
    for t, n in counts.items():
        if n:
            try:
                explicit[t] = max(1, int(n))
            except (TypeError, ValueError):
                continue
    if explicit:
        plan = {t: explicit.get(t, DEFAULT_PER_FORMAT) for t in ordered_types}
    elif overall_count:
        total = max(1, int(overall_count))
        total_w = float(len(ordered_types))
        raw = {t: 1.0 * total / total_w for t in ordered_types}
        plan = {t: int(raw[t]) for t in ordered_types}
        remaining = total - sum(plan.values())
        if remaining > 0:
            for t in sorted(ordered_types, key=lambda x: raw[x] - float(plan[x]), reverse=True):
                if remaining <= 0:
                    break
                plan[t] += 1
                remaining -= 1
    else:
        plan = {t: DEFAULT_PER_FORMAT for t in ordered_types}
    # Reject over-limit requests BEFORE clamping so the user is told the maximum
    # instead of silently receiving fewer questions than they asked for.
    requested_total = sum(c for c in plan.values() if c > 0)
    if requested_total > MAX_AI_QUESTIONS:
        raise GroqAPIError(
            "COUNT_EXCEEDS_MAX",
            f"You can generate a maximum of {MAX_AI_QUESTIONS} questions only. Please reduce the number and try again.",
        )
    plan = {t: min(c, MAX_AI_QUESTIONS) for t, c in plan.items() if c > 0}
    return _clamp_plan_total(plan, MAX_AI_QUESTIONS) or None


def _mc_index(correct, options):
    """Normalizes a multiple-choice correctAnswer (int, digit string, or option letter)
    into a valid option index."""
    if isinstance(correct, bool):
        return int(correct)
    if isinstance(correct, int):
        return correct
    if isinstance(correct, float) and correct.is_integer():
        return int(correct)
    if isinstance(correct, str):
        cl = correct.strip()
        if cl.isdigit():
            return int(cl)
        if len(cl) == 1 and cl.upper() in "ABCD":
            return "ABCD".index(cl.upper())
        for i, opt in enumerate(options):
            if str(opt).strip().lower() == cl.lower():
                return i
    return None


def _tf_index(correct):
    """Normalizes a true_false correctAnswer into 0 (True) or 1 (False)."""
    if isinstance(correct, bool):
        return 0 if correct else 1
    if isinstance(correct, int):
        return 0 if correct == 0 else 1
    if isinstance(correct, str):
        cl = correct.strip().lower()
        if cl in ("0", "1"):
            return int(cl)
        if cl in ("true", "t", "yes", "a", "correct"):
            return 0
        if cl in ("false", "f", "no", "b"):
            return 1
    return None


def _normalize_question_shapes(questions):
    """Coerces every question into a valid, self-consistent shape for its declared type.

    - identification -> ``options: []`` and a string ``correctAnswer``
    - true_false     -> ``options: ["True", "False"]`` with a 0/1 index
    - multiple_choice -> real option list with a valid 0-based index

    Questions with an unknown/missing type are inferred from their shape (options+index
    => multiple_choice, otherwise identification).
    """
    out = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        q = dict(q)
        qtype = str(q.get("type") or "").strip().lower().replace("-", "_").replace(" ", "_")
        if qtype in ("tf", "truefalse"):
            qtype = "true_false"
        if qtype in ("identify", "identifications"):
            qtype = "identification"
        options = q.get("options")
        if qtype not in ("multiple_choice", "true_false", "identification", "short_answer"):
            if isinstance(options, list) and len(options) >= 2:
                qtype = "multiple_choice"
            else:
                qtype = "identification"
        if qtype in ("identification", "short_answer"):
            q["type"] = "identification"
            q["options"] = []
            correct = q.get("correctAnswer")
            q["correctAnswer"] = str(correct if correct is not None else "")
        elif qtype == "true_false":
            q["type"] = "true_false"
            q["options"] = (list(options[:2]) if isinstance(options, list) and len(options) >= 2
                            else ["True", "False"])
            idx = _tf_index(q.get("correctAnswer"))
            q["correctAnswer"] = 0 if idx is None else idx
        else:
            q["type"] = "multiple_choice"
            q["options"] = (list(options) if isinstance(options, list) and len(options) >= 2
                            else ["Option A", "Option B"])
            idx = _mc_index(q.get("correctAnswer"), q["options"])
            if idx is None or not (0 <= idx < len(q["options"])):
                idx = 0
            q["correctAnswer"] = idx
        out.append(q)
    return out


def _composition_system_prompt():
    """System prompt for multiple-format quiz generation: documents the exact JSON schema
    for every supported question type so the model emits structurally valid items."""
    return (
        "You are StudyLens AI Assessment Generator powered by Groq Inference (GPT-OSS-120B). "
        "Return a raw JSON array of quiz questions. Every item MUST match exactly ONE of "
        "these schemas (chosen by the requested type) and include every field:\n\n"
        "SCHEMA A — type \"multiple_choice\":\n"
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
        "  }\n\n"
        "SCHEMA B — type \"identification\":\n"
        "  {\n"
        '    "id": "q1",\n'
        '    "question": "Identify the term/concept described by ...?",\n'
        '    "type": "identification",\n'
        '    "options": [],\n'
        '    "correctAnswer": "exact term or short phrase",\n'
        '    "explanation": "Detailed explanation of correct answer",\n'
        '    "bloomsLevel": "Understanding",\n'
        '    "difficulty": "medium",\n'
        '    "topicTag": "Topic Name"\n'
        "  }\n\n"
        "SCHEMA C — type \"true_false\":\n"
        "  {\n"
        '    "id": "q1",\n'
        '    "question": "A single clear statement to mark True or False.",\n'
        '    "type": "true_false",\n'
        '    "options": ["True", "False"],\n'
        '    "correctAnswer": 0,\n'
        '    "explanation": "Detailed explanation of correct answer",\n'
        '    "bloomsLevel": "Understanding",\n'
        '    "difficulty": "medium",\n'
        '    "topicTag": "Topic Name"\n'
        "  }\n\n"
        "Observe the requested type for each question and use the matching schema above.\n\n"
        "TOPIC FOCUS (strict):\n"
        "- Every question MUST test the actual SUBJECT MATTER in the provided material text (for example, the database concepts themselves), NOT the quiz format.\n"
        "- NEVER generate questions about assessment formats, question types, pedagogy, education theory, or generic test-taking ideas. For example, do NOT ask what a multiple-choice / identification / true-or-false question is, or what an assessment format requires.\n"
        "- The words \"multiple choice\", \"identification\", and \"true or false\" describe the FORMAT you must use — they are NOT the subject of the questions.\n"
        "- If the material does not contain enough information about the requested topic, return fewer on-topic questions rather than inventing off-topic ones."
    )


def _composition_request_prompt(qtype, need, chunk, difficulty, instructions, existing_block, request_no):
    """Builds a per-format batch prompt asking the AI for exactly ``need`` questions of
    one specific type, grounded in ``chunk``."""
    labels = {
        "multiple_choice": "multiple-choice",
        "identification": "identification",
        "true_false": "true or false",
    }
    rules_by_type = {
        "multiple_choice": (
            "OPTION RULES (strict):\n"
            "- Every option must be SHORT (roughly 1 to 8 words), self-contained, and distinct — a plausible answer phrase, never a quoted paragraph or full sentence copied from the document.\n"
            "- NEVER copy a document sentence verbatim, and NEVER truncate an option with '...'.\n"
            "- Keep the three wrong options the same KIND of answer as the correct one (all short facts, all short terms, etc.) so the question is genuinely discriminating.\n"
            '- "correctAnswer" must be the index of the exactly-correct option; make sure only ONE option is correct.\n'
            "- Vary the correct answer position across questions (mix indices 0, 1, 2, 3) — never always place the correct option first.\n"
        ),
        "identification": (
            "IDENTIFICATION RULES (strict):\n"
            '- The question must ask the reader to "Identify" (or name) a specific term, concept, person, formula, or short phrase from the material.\n'
            '- "correctAnswer" must be the exact one-word or short-phrase answer, concise as the learner should type it.\n'
            '- Set "options" to an empty array [] for these questions.\n'
        ),
        "true_false": (
            "TRUE/FALSE RULES (strict):\n"
            '- The question must be a single clear statement the learner marks True or False.\n'
            '- Set "options" to exactly ["True", "False"].\n'
            '- "correctAnswer" must be 0 when the statement is TRUE and 1 when it is FALSE.\n'
            "- Mix TRUE and FALSE statements (roughly half of each), and every FALSE statement must be genuinely false per the material.\n"
        ),
    }
    rule = rules_by_type.get(qtype, rules_by_type["multiple_choice"])
    label = labels.get(qtype, "assessment")
    gen_line = (
        f"Generate exactly {need} NEW additional high-quality {label} assessment questions, "
        f"ALL of type \"{qtype}\", based on the following material.\n"
    )
    return (
        gen_line
        + rule
        + f"\nTarget Difficulty: {difficulty}\n"
        "The material below is the ONLY source of truth. Generate every question strictly about the subject matter in this section.\n"
        "Do NOT write questions about quiz formats, assessment methods, education theory, or generic test-taking concepts "
        "(e.g. never ask what an identification / multiple-choice / true-or-false question is). "
        "If this section lacks enough relevant content, return fewer on-topic questions instead of off-topic ones.\n"
        f"{_instruction_directive(instructions)}"
        f"{existing_block}"
        f"\nMaterial Text (request {request_no}):\n{chunk}\n\n"
        "Return ONLY raw valid JSON array."
    )


def _top_up_questions(qtype, target, text_content, difficulty, tickets):
    """Caps a per-type list at ``target``, topping up any shortfall with the matching
    content-derived offline builder so exact requested counts are always honored."""
    items = list(tickets)[:target]
    if len(items) >= target:
        return items[:target]
    need = target - len(items)
    if qtype == "identification":
        more = _build_identification_questions(text_content, need, tickets)
    elif qtype == "true_false":
        more = _build_true_false_questions(text_content, need, tickets)
    else:
        more = _build_quiz_fallback(text_content, need, difficulty, tickets)
    items.extend(more)
    return items[:target]


def _generate_composed_quiz(text_content, plan, difficulty, instructions, context):
    """Generates a quiz composed of multiple question formats with exact counts.

    Each requested format is generated in its own small, type-specific AI batch whose
    shortfalls are topped up from the offline builders, so the returned set always
    contains exactly the planned number of items per format.
    """
    order = list(plan.keys())
    generated = {t: [] for t in order}
    system_prompt = _composition_system_prompt()
    request_no = 0
    offline_reason = ""
    for qtype in order:
        target = plan[qtype]
        rounds = 0
        while len(generated[qtype]) < target and rounds < MAX_BATCH_ROUNDS and not offline_reason:
            rounds += 1
            chunks = _generation_chunks(text_content, 4000)
            added = False
            for chunk in chunks:
                if len(generated[qtype]) >= target:
                    break
                need = min(MAX_PER_CHUNK, target - len(generated[qtype]))
                request_no += 1
                existing_block = _context_existing_block(list(generated[qtype]) + list(context or []), "QUESTIONS")
                prompt = _composition_request_prompt(
                    qtype, need, chunk, difficulty, instructions, existing_block, request_no
                )
                if request_no > 1:
                    time.sleep(BATCH_CALL_PACING_SECONDS)
                try:
                    parsed = _ai_json_call(prompt, system_prompt=system_prompt, temperature=0.5)
                except GroqOfflineError as e:
                    offline_reason = e.code or "OFFLINE_USED"
                    break
                if isinstance(parsed, list):
                    for item in parsed:
                        if not isinstance(item, dict):
                            continue
                        item = _normalize_question_shapes([item])[0]
                        if item.get("type") == qtype:
                            generated[qtype].append(item)
                    added = True
            if not added:
                break
        if len(generated[qtype]) < target:
            generated[qtype] = _top_up_questions(
                qtype, target, text_content, difficulty, generated[qtype] + list(context or [])
            )
    if offline_reason:
        mark_offline_fallback(offline_reason)
    result = []
    for t in order:
        result.extend(generated[t])
    return result[:sum(plan.values())]


def generate_quiz_with_groq(text_content: str, num_questions: int = 5, difficulty: str = "medium", instructions: str = "", context: list = None, require_count: bool = False) -> list:
    """
    Generates structured assessment questions classified strictly into Bloom's Taxonomy 6 cognitive levels:

    - Remembering, Understanding, Applying, Analyzing, Evaluating, Creating

    When a user instruction (or, on mobile, the source text itself) names specific formats
    such as "5 identification, 10 multiple choice, 5 true or false", exactly the requested
    counts are generated (prompt is the single source of truth). Formats named without an
    explicit number default to 5 each; an overall total like "20 questions" splits evenly
    across the named formats. With no formats named, every question is multiple-choice and
    the prompt's overall count (e.g. "make 20 questions") sets the total. Set
    ``require_count`` to True when the caller no longer provides a count box: a prompt that
    names neither a format nor an overall count then raises ``GroqAPIError("COUNT_REQUIRED")``
    so the UI can tell the user to include a number.

    When ``context`` (previously generated questions) is supplied, only NEW non-duplicate
    questions are generated and the combined set is returned with the new ones flagged.
    """
    blooms_levels = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
    context = context or []

    # Auto-correct only genuinely misspelled quiz-type words in user's prompt text.
    # Do NOT touch correctly-spelled names like "multiple choice", "identification", "true/false".
    def _correct_spelling(text):
        if not isinstance(text, str) or not text:
            return text
        _map = {
            "identication": "identification", "identifications": "identification",
            "identifcation": "identification", "true/fasle": "true/false",
            "truefalse": "true/false", "t/f": "true/false",
            "multichoice": "multiple choice", "mcq": "multiple choice",
            "shortanswer": "identification", "short answer": "identification",
        }
        result = text
        lower = text.lower()
        for wrong, correct in _map.items():
            if wrong in lower:
                result = result.replace(wrong, correct).replace(wrong.title(), correct.title()).replace(wrong.upper(), correct.upper())
        return result

    instructions = _correct_spelling(instructions or "")
    text_content = _correct_spelling(text_content or "")

    # When no source material is attached but the user gave instructions (a topic
    # request like "questions about Querying"), extract the topic from the
    # instructions and build a short topic scaffold so questions are grounded in
    # the actual subject instead of treating the request text as source material.
    if not text_content.strip() and instructions.strip():
        topic = None
        for prep in ("with", "about", "on", "for", "of", "in", "regarding"):
            m = re.search(rf"\b{prep}\s+([A-Za-z][A-Za-z0-9\- ]+)", instructions, re.IGNORECASE)
            if m:
                topic = m.group(1).strip(".,;:!?").strip()
                break
        if not topic:
            topic = _prompt_topic(instructions)
        text_content = (
            f"{topic}\n"
            f"Topic: {topic}. Generate study material about this topic using your own knowledge of it.\n"
            f"Key focus areas: core definitions, main concepts, important terminology, key processes, and practical applications related to {topic}.\n"
            f"Cover the essential ideas a student must understand about {topic}."
        )

    try:
        num_questions = int(num_questions)
    except (TypeError, ValueError):
        num_questions = 5
    if num_questions > MAX_AI_QUESTIONS:
        raise GroqAPIError(
            "COUNT_EXCEEDS_MAX",
            f"You can generate a maximum of {MAX_AI_QUESTIONS} questions only. Please reduce the number and try again.",
        )
    num_questions = max(1, min(MAX_AI_QUESTIONS, num_questions))

    if _is_prompt_like(text_content):
        text_content = _expand_prompt_material(text_content)

    # Honor requested question formats. The instruction (Prompt box) is the primary
    # source; the source text is scanned too for mobile/prompt-only flows, but only when
    # there is a strong signal (multiple formats or at least one explicit count) so
    # ordinary body text that merely contains the word "identification" is not misread.
    ordered_types, type_counts = None, None
    if instructions and instructions.strip():
        ordered_types, type_counts = _parse_quiz_types(instructions)
    if not ordered_types:
        o, c = _parse_quiz_types(text_content)
        if o and (len(o) >= 2 or (c and any(v is not None and v > 0 for v in c.values()))):
            ordered_types, type_counts = o, c

    if ordered_types:
        overall_count = _extract_overall_count(instructions) or _extract_overall_count(text_content)
        plan = _resolve_quiz_plan(ordered_types, type_counts, overall_count)
        if plan:
            composed = _generate_composed_quiz(text_content, plan, difficulty, instructions, context)
            return _randomize_mc_correct_answer(_merge_context_and_new(context, composed, "q"))

    # No formats named: the prompt's overall count (e.g. "make 20 questions") sets the
    # total when present; otherwise the caller-supplied count is used. Once the quiz
    # count box was removed from the UI, the prompt must mention a count, so raise a
    # structured error the route surface turns into a friendly validation message.
    overall_count = _extract_overall_count(instructions) or _extract_overall_count(text_content)
    if overall_count is not None:
        if overall_count > MAX_AI_QUESTIONS:
            raise GroqAPIError(
                "COUNT_EXCEEDS_MAX",
                f"You can generate a maximum of {MAX_AI_QUESTIONS} questions only. Please reduce the number and try again.",
            )
        num_questions = max(1, min(MAX_AI_QUESTIONS, overall_count))
    elif require_count:
        # No explicit count was given: default to 5 questions instead of blocking.
        num_questions = 5

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
        "]\n\n"
        "TOPIC FOCUS (strict): Every question MUST test the actual subject matter in the "
        "provided material. NEVER generate questions about quiz formats, assessment methods, "
        "education theory, or generic test-taking concepts. The words used to describe a "
        "question format are NOT the subject of the questions. If the material lacks enough "
        "relevant content, generate fewer on-topic questions rather than off-topic ones."
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
                f"The material below is the ONLY source of truth. Generate every question strictly about the subject matter in this section.\n"
                "Do NOT write questions about quiz formats, assessment methods, education theory, or generic test-taking concepts.\n"
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


def _question_hint_fallback(topic: str, options: list) -> str:
    """Question-anchored fallback used only when the AI hint cannot be generated."""
    topic = str(topic or "").strip()
    if topic:
        return (
            f"Focus on how '{topic}' is defined and applied in this exact question; "
            "identify the key term or relationship it tests."
        )
    if isinstance(options, list) and options:
        return (
            "Focus on the exact relationship the question asks about, then eliminate "
            "options that describe a different concept."
        )
    return (
        "Focus on the key term and relationship being tested in this exact question, "
        "not the broader quiz topic."
    )


def generate_hint_with_groq(question: str, options: list, question_type: str = "", topic: str = "") -> str:
    """Generates a subtle 1-2 sentence hint for exactly one quiz question.

    The hint is deliberately anchored to the supplied question so students never
    receive a quiz-wide or topic-wide hint. Never raises: on any failure (offline,
    rate limited, invalid response) it returns a question-aware fallback.
    """
    question = str(question or "").strip()
    question_type = str(question_type or "").strip()
    topic = str(topic or "").strip()
    if not question:
        return "Review the core definitions and key terms covered in this topic."

    system_prompt = (
        "You are StudyLens AI Hint Assistant powered by Groq Inference (GPT-OSS-120B). "
        "Write a hint for exactly one quiz question. The hint must be specific to that "
        "question, not to the quiz or subject in general. Do not give generic study advice. "
        "Do not reveal, quote, or name the correct answer. Mention a key term, comparison, "
        "or reasoning step from the question. Write 1-2 sentences."
    )
    options_block = (
        f"Options: {json.dumps(options)}\n"
        if isinstance(options, list) and options
        else ""
    )
    prompt = (
        "Write a subtle, helpful 1-2 sentence hint for THIS exact question only.\n"
        f"Question type: {question_type or 'unknown'}\n"
        f"Topic: {topic or 'not provided'}\n"
        f"Question: {question}\n"
        f"{options_block}"
        "\nRules:\n"
        "- Do not summarize the quiz or give broad topic advice.\n"
        "- Do not reveal or quote the correct answer.\n"
        "- For multiple choice, explain what to compare or eliminate without naming the correct option.\n"
        "- For true/false, name the principle to check without saying whether it is true.\n"
        "- For identification, describe the category or definition without giving the exact term.\n"
        "- Anchor the hint in a specific term or relationship from the question."
    )

    try:
        raw = call_groq_ai(prompt, system_prompt=system_prompt, temperature=0.4)
    except GroqOfflineError as e:
        mark_offline_fallback(e.code or "OFFLINE_USED")
        return _question_hint_fallback(topic, options)
    except GroqAPIError:
        return _question_hint_fallback(topic, options)

    hint = str(raw or "").strip().strip('"')
    if hint:
        return hint[:300]
    return _question_hint_fallback(topic, options)


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