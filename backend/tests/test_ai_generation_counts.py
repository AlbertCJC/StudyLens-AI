"""Regression tests: AI generation must honor requested counts up to the new 50 cap.

Previously all generation loops stopped after MAX_BATCH_ROUNDS (4) x MAX_PER_CHUNK (10)
= 40 items per single-chunk source text, so asking for 50 quiz questions or flashcards
deterministically returned only 40. These tests mock the AI call to return full chunks
and assert the requested count is honored in full.
"""

import re

import groq_service
import pytest


def _make_flashcard(i):
    return {
        "id": f"fc-{i}",
        "question": f"Flashcard question {i}?",
        "answer": f"Flashcard answer {i}.",
        "topicTag": "General Concepts",
        "difficulty": "medium",
    }


def _make_quiz(i, qtype="multiple_choice"):
    base = {
        "id": f"qz-{i}",
        "question": f"Quiz question {i}?",
        "type": qtype,
        "explanation": "Because.",
        "bloomsLevel": "Understanding",
        "difficulty": "medium",
        "topicTag": "General Concepts",
    }
    if qtype == "multiple_choice":
        base["options"] = ["A", "B", "C", "D"]
        base["correctAnswer"] = 0
    elif qtype == "true_false":
        base["options"] = ["True", "False"]
        base["correctAnswer"] = 0
    else:  # identification
        base["options"] = []
        base["correctAnswer"] = "photosynthesis"
    return base


def test_generate_flashcards_returns_full_count(monkeypatch):
    calls = []

    def fake_ai_json_call(prompt, **kwargs):
        calls.append(prompt)
        need = int(re.search(r"Create (\d+)", prompt).group(1))
        return [_make_flashcard(len(calls) * 10 + j) for j in range(need)]

    monkeypatch.setattr(groq_service, "_ai_json_call", fake_ai_json_call)

    cards = groq_service.generate_flashcards_with_groq(
        "Photosynthesis converts light energy into chemical energy in plants.",
        count=50,
    )

    assert len(cards) == 50, f"Expected 50 flashcards, got {len(cards)}"
    assert len(calls) == 5  # 5 rounds x 10 = 50


def test_generate_quiz_returns_full_count(monkeypatch):
    calls = []

    def fake_ai_json_call(prompt, **kwargs):
        calls.append(prompt)
        need = int(re.search(r"Generate (\d+)", prompt).group(1))
        return [_make_quiz(len(calls) * 10 + j) for j in range(need)]

    monkeypatch.setattr(groq_service, "_ai_json_call", fake_ai_json_call)

    questions = groq_service.generate_quiz_with_groq(
        "Photosynthesis converts light energy into chemical energy in plants.",
        num_questions=50,
    )

    assert len(questions) == 50, f"Expected 50 quiz questions, got {len(questions)}"
    assert len(calls) == 5  # 5 rounds x 10 = 50


def test_composed_quiz_returns_full_count(monkeypatch):
    calls = []

    def fake_ai_json_call(prompt, **kwargs):
        calls.append(prompt)
        need = int(re.search(r"Generate exactly (\d+)", prompt).group(1))
        m = re.search(r'ALL of type "([^"]+)"', prompt)
        qtype = m.group(1) if m else "multiple_choice"
        return [_make_quiz(len(calls) * 10 + j, qtype) for j in range(need)]

    monkeypatch.setattr(groq_service, "_ai_json_call", fake_ai_json_call)

    plan = {"multiple_choice": 25, "true_false": 25}
    questions = groq_service._generate_composed_quiz(
        "Photosynthesis converts light energy into chemical energy in plants.",
        plan,
        "medium",
        "",
        None,
    )

    assert len(questions) == 50, f"Expected 50 composed quiz questions, got {len(questions)}"
    mc = [q for q in questions if q.get("type") == "multiple_choice"]
    tf = [q for q in questions if q.get("type") == "true_false"]
    assert len(mc) == 25
    assert len(tf) == 25


def test_quiz_over_limit_still_rejected():
    with pytest.raises(groq_service.GroqAPIError) as exc:
        groq_service.generate_quiz_with_groq(
            "Some content.",
            num_questions=51,
        )
    assert exc.value.code == "COUNT_EXCEEDS_MAX"
    assert "maximum of 50 questions" in exc.value.message


def test_flashcards_over_limit_clamped():
    # Flashcards are clamped (not rejected) at the generator; count > 50 becomes 50.
    cards = groq_service.generate_flashcards_with_groq("content", count=99)
    assert len(cards) <= 50
