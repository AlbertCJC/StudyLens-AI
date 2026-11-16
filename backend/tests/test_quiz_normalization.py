"""Quiz question shape normalization for legacy and producer encodings."""

from lib.quiz import normalize_question_shape


def _q(qtype, correct, options=None):
    return {
        "type": qtype,
        "question": "Example?",
        "correctAnswer": correct,
        "options": options or [],
    }


def test_true_false_options_and_encodings_are_normalized():
    for value, expected in (
        (True, 0),
        (False, 1),
        (0, 0),
        (1, 1),
        ("A", 0),
        ("B", 1),
        ("True", 0),
        ("False", 1),
    ):
        q = normalize_question_shape(_q("true_false", value))
        assert q["options"] == ["True", "False"]
        assert q["correctAnswer"] == expected


def test_multiple_choice_letter_answers_are_normalized():
    q = normalize_question_shape(
        _q("multiple_choice", "B", ["alpha", "beta", "gamma", "delta"])
    )
    assert q["correctAnswer"] == 1


def test_identification_drops_options_and_stringifies_answer():
    q = normalize_question_shape(
        _q("identification", 42, ["should", "be", "removed"])
    )
    assert q["options"] == []
    assert q["correctAnswer"] == "42"
