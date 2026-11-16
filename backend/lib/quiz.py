"""Pure quiz-shape helpers.

These functions intentionally have no database or Flask dependencies so both
models and services can use them without creating import cycles.
"""


def _canonical_question_type(q):
    """Returns a canonical question type for a question dict.

    Recognized types: "multiple_choice", "true_false", "identification".
    Honors aliases from any producer and falls back to shape inference
    (True/False option pair, then option count).
    """
    t = str(q.get("type") or "").strip().lower().replace("-", "_").replace(" ", "_")
    if t in ("mc", "multiplechoice", "multiple_choice"):
        return "multiple_choice"
    if t in ("tf", "truefalse", "true_false"):
        return "true_false"
    if t in ("identify", "identifications", "shortanswer", "short_answer", "identification"):
        return "identification"
    options = q.get("options")
    if isinstance(options, list):
        normalized = {str(o).strip().lower() for o in options}
        if len(options) == 2 and normalized == {"true", "false"}:
            return "true_false"
        if len(options) >= 2:
            return "multiple_choice"
    return "identification"


def _answer_index(value, options):
    """Maps an answer value (option index, "A"-"Z" letter, or option text) to a 0-based index.

    Returns None when the value cannot be resolved to a valid option index.
    """
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if 0 <= value < len(options) else None
    text = str(value).strip()
    if text.isdigit():
        idx = int(text)
        return idx if 0 <= idx < len(options) else None
    letter = text.upper()
    if len(letter) == 1 and "A" <= letter <= "Z":
        idx = ord(letter) - ord("A")
        return idx if 0 <= idx < len(options) else None
    for i, opt in enumerate(options):
        if str(opt).strip().lower() == text.lower():
            return i
    return None


def _true_false_index(value):
    """Normalizes a true/false answer to 0 (True) or 1 (False), or None.

    Accepts booleans, 0/1, "0"/"1", "A"/"B", and true/false-style words so
    legacy rows and every producer encoding behave consistently.
    """
    if isinstance(value, bool):
        return 0 if value else 1
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if int(value) == 0:
            return 0
        if int(value) == 1:
            return 1
        return None
    if isinstance(value, (list, tuple)) and value:
        return _true_false_index(value[0])
    if isinstance(value, str):
        text = value.strip().lower()
        if text in ("0", "true", "t", "yes", "a", "correct"):
            return 0
        if text in ("1", "false", "f", "no", "b", "incorrect"):
            return 1
    return None


def normalize_question_shape(q):
    """Returns a canonical copy of a quiz question with a self-consistent answer.

    Canonical shapes:
      - true_false: ``options=["True", "False"]`` and ``correctAnswer`` 0/1
      - identification: ``options=[]`` and a string ``correctAnswer``
      - multiple_choice: real options and a valid 0-based index (or an index list
        for multi-answer questions)

    This keeps read paths, create/update paths, and grading aligned without
    requiring a data migration for legacy quizzes.
    """
    if not isinstance(q, dict):
        return q
    out = dict(q)
    qtype = _canonical_question_type(out)
    out["type"] = qtype

    if qtype == "true_false":
        out["options"] = ["True", "False"]
        idx = _true_false_index(out.get("correctAnswer"))
        out["correctAnswer"] = 0 if idx is None else idx
        return out

    if qtype == "identification":
        out["options"] = []
        correct = out.get("correctAnswer")
        out["correctAnswer"] = "" if correct is None else str(correct)
        return out

    options = out.get("options")
    options = [str(o) for o in options] if isinstance(options, list) else []
    out["options"] = options
    correct = out.get("correctAnswer")
    if isinstance(correct, list):
        resolved = [_answer_index(value, options) for value in correct]
        out["correctAnswer"] = [idx for idx in resolved if idx is not None]
    else:
        idx = _answer_index(correct, options)
        out["correctAnswer"] = 0 if idx is None else idx
    return out


def normalize_quiz_questions(questions):
    """Normalizes every dict question in a list; ignores non-dict entries."""
    return [normalize_question_shape(q) for q in (questions or []) if isinstance(q, dict)]
