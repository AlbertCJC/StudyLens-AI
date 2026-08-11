import os
import json
import math
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
GROQ_MAX_OUTPUT_TOKENS = 4096
REQUEST_TIMEOUT_SECONDS = 45

# Records whether the most recent generation degraded to offline content-derived output,
# so callers can surface a clear "offline mode" notice instead of silently returning fallback results.
_generation_used_fallback = False


def reset_generation_source() -> None:
    """Resets the offline-fallback flag before a fresh generation request."""
    global _generation_used_fallback
    _generation_used_fallback = False


def mark_offline_fallback() -> None:
    """Records that the current generation degraded to content-derived offline output."""
    global _generation_used_fallback
    _generation_used_fallback = True


def generation_used_fallback() -> bool:
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
    def __init__(self, message: str = "AI provider unavailable; using local offline generation."):
        super().__init__("OFFLINE", message)


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
        raise GroqOfflineError("No API key configured.")

    if not _GROQ_SDK_AVAILABLE:
        print("[Groq GPT-OSS-120B] OpenAI SDK not installed; using built-in content-derived offline generation.")
        raise GroqOfflineError("OpenAI SDK is not installed.")

    client = OpenAI(api_key=api_key, base_url=GROQ_API_URL, timeout=REQUEST_TIMEOUT_SECONDS, max_retries=1)

    for model in (GROQ_PRIMARY_MODEL, GROQ_FALLBACK_MODEL):
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
                raise GroqOfflineError("AI service billing is not active; using offline generation.")
            if status == 404:
                # Requested model is unavailable for this provider -> try the fallback model.
                continue
            if status == 429:
                # Rate limited (common on Groq free tier) -> short backoff, then fallback model.
                time.sleep(2)
                continue
            if status == 413:
                # Free tier TPM budget exceeded (Groq uses 413 rate_limit_exceeded) ->
                # back off, then retry with the fallback model (higher TPM allowance).
                print("[Groq] Token rate limit reached (HTTP 413). Retrying with the fallback model.")
                time.sleep(2)
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

    raise GroqAPIError("RATE_LIMITED", "You have reached the AI generation limit for this session. Please wait a moment and try again.")


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


def _build_quiz_fallback(text_content, num_questions, difficulty):
    blooms_levels = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]
    stems = [
        "Based on the material, which statement is correct?",
        "According to the material, which of the following is true?",
        "Select the accurate statement from the material.",
        "Which statement correctly reflects the material?"
    ]
    sentences = _sentences(text_content) or [_trim(text_content) or "Review the key concepts of this material."]
    topics = _topics_from_text(text_content)
    questions = []
    for i in range(num_questions):
        main = sentences[i % len(sentences)]
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
            "question": stems[i % len(stems)],
            "type": "multiple_choice",
            "options": [opt(main)] + [opt(d) for d in distractors],
            "correctAnswer": 0,
            "explanation": f"From the material: {_trim(main, 160)}",
            "bloomsLevel": blooms_levels[i % len(blooms_levels)],
            "difficulty": difficulty,
            "topicTag": topics[i % len(topics)]
        })
    return questions


def _build_flashcards_fallback(text_content, count):
    sentences = _sentences(text_content) or [_trim(text_content) or "Key concept to review."]
    topics = _topics_from_text(text_content)
    cards = []
    for i in range(count):
        sent = sentences[i % len(sentences)]
        words = [w.rstrip(".,;:") for w in sent.split() if len(w.rstrip(".,;:")) > 4]
        q_word = words[i % len(words)] if words else "key concept"
        top = topics[i % len(topics)]
        cards.append({
            "id": f"fc-{i+1}",
            "question": f"Define or explain: {q_word}",
            "answer": _trim(sent, 140),
            "topicTag": top,
            "difficulty": "medium"
        })
    return cards


def _build_summary_fallback(text_content):
    sentences = _sentences(text_content) or [_trim(text_content, 200) or "The material covers key concepts for this subject."]
    lead = " ".join(sentences[:2])
    return {
        "executiveSummary": _trim(lead, 280),
        "keyTakeaways": [_trim(s, 120) for s in sentences[:4]] or [_trim(lead, 120)],
        "bulletPoints": [_trim(s, 120) for s in sentences[4:9]] or [_trim(s, 120) for s in sentences[:3]]
    }


def _build_reviewer_fallback(text_content):
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

def generate_quiz_with_groq(text_content: str, num_questions: int = 5, difficulty: str = "medium", instructions: str = "") -> list:
    """
    Generates structured assessment questions classified strictly into Bloom's Taxonomy 6 cognitive levels:

    - Remembering, Understanding, Applying, Analyzing, Evaluating, Creating
    """
    blooms_levels = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"]

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
    per_chunk = max(1, math.ceil(num_questions / len(chunks)))

    questions = []
    for chunk in chunks:
        prompt = (
            f"Generate {per_chunk} high-quality adaptive assessment questions based on the following material.\n"
            f"Ensure questions cover Bloom's 6 cognitive levels: Remembering, Understanding, Applying, Analyzing, Evaluating, Creating.\n"
            f"Target Difficulty: {difficulty}\n"
            f"The material below is the PRIMARY source. Use this entire section and generate every question strictly from its own concepts.\n"
            "OPTION RULES (strict):\n"
            "- Every option must be SHORT (roughly 1 to 8 words), self-contained, and distinct — a plausible answer phrase, never a quoted paragraph or full sentence copied from the document.\n"
            "- NEVER copy a document sentence verbatim, and NEVER truncate an option with '...'.\n"
            "- Keep the three wrong options the same KIND of answer as the correct one (all short facts, all short terms, etc.) so the question is genuinely discriminating.\n"
            '- "correctAnswer" must be the index of the exactly-correct option; make sure only ONE option is correct.\n'
            '- The "explanation" must explain the concept in your OWN words and may briefly cite the material; do not start it with "From the material:" quoting a full sentence.\n'
            f"{_instruction_directive(instructions)}"
            f"\nMaterial Text (section {len(questions) // per_chunk + 1} of {len(chunks)}):\n{chunk}\n\n"
            "Return ONLY raw valid JSON array."
        )
        try:
            raw_output = call_groq_ai(prompt, system_prompt=system_prompt, temperature=0.5)
        except GroqOfflineError:
            mark_offline_fallback()
            return _build_quiz_fallback(text_content, num_questions, difficulty)
        parsed = _parse_json_answer(raw_output)
        if isinstance(parsed, list):
            questions.extend(parsed)

    if len(questions) >= 1:
        for idx, q in enumerate(questions):
            if isinstance(q, dict):
                q["id"] = f"q-{idx + 1}"
        return questions[:num_questions]

    # Degrade to content-derived questions grounded in the actual material.
    print("[Groq Quiz] Falling back to content-derived question generation.")
    mark_offline_fallback()
    return _build_quiz_fallback(text_content, num_questions, difficulty)


def generate_flashcards_with_groq(text_content: str, count: int = 5, instructions: str = "") -> list:
    system_prompt = (
        "You are StudyLens AI Flashcard Generator powered by Groq Inference (GPT-OSS-120B). "
        "Return a raw JSON array of objects with keys: id, question, answer, topicTag, difficulty."
    )

    chunks = _generation_chunks(text_content, 3500)
    per_chunk = max(1, math.ceil(count / len(chunks)))

    cards = []
    for chunk in chunks:
        prompt = f"Create {per_chunk} concise active-recall flashcards from this text section. Use this entire section and base every card only on its concepts:{_instruction_directive(instructions)}\n\nMaterial Text (section {len(cards) // per_chunk + 1} of {len(chunks)}):\n{chunk}"
        try:
            raw = call_groq_ai(prompt, system_prompt=system_prompt, temperature=0.6)
        except GroqOfflineError:
            mark_offline_fallback()
            return _build_flashcards_fallback(text_content, count)
        parsed = _parse_json_answer(raw)
        if isinstance(parsed, list):
            cards.extend(parsed)

    if len(cards) >= 1:
        for idx, c in enumerate(cards):
            if isinstance(c, dict):
                c["id"] = f"fc-{idx + 1}"
        return cards[:count]

    print("[Groq Flashcards] Falling back to content-derived flashcard generation.")
    mark_offline_fallback()
    return _build_flashcards_fallback(text_content, count)


def generate_summary_with_groq(text_content: str, instructions: str = "") -> dict:
    system_prompt = (
        "You are StudyLens AI Document Summarizer powered by Groq Inference (GPT-OSS-120B). "
        "Return JSON with keys: executiveSummary (string), keyTakeaways (list of string), bulletPoints (list of string)."
    )

    chunks = _generation_chunks(text_content, 4000)
    summaries = []
    for chunk in chunks:
        prompt = f"Summarize the following study material section. Read this whole section and capture its definitions and key conclusions:{_instruction_directive(instructions)}\n\nMaterial Text (section {len(summaries) + 1} of {len(chunks)}):\n{chunk}"
        try:
            raw = call_groq_ai(prompt, system_prompt=system_prompt, temperature=0.5)
        except GroqOfflineError:
            mark_offline_fallback()
            return _build_summary_fallback(text_content)
        parsed = _parse_json_answer(raw)
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

    chunks = _generation_chunks(text_content, 4000)
    reviewers = []
    for chunk in chunks:
        prompt = f"Create a study reviewer for this material section: a concept overview and topic-by-topic breakdown. Use this entire section and ground every topic in its own content:{_instruction_directive(instructions)}\n\nMaterial Text (section {len(reviewers) + 1} of {len(chunks)}):\n{chunk}"
        try:
            raw = call_groq_ai(prompt, system_prompt=system_prompt, temperature=0.5)
        except GroqOfflineError:
            mark_offline_fallback()
            return _build_reviewer_fallback(text_content)
        parsed = _parse_json_answer(raw)
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
    except GroqOfflineError:
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
    except GroqOfflineError:
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