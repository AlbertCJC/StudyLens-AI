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
