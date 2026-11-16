"""Prompt parsing and short-topic behavior for AI quiz generation."""

import re

import pytest

import groq_service
from lib.constants import MAX_AI_FLASHCARDS, MAX_AI_QUESTIONS


def test_short_bare_topic_is_expanded():
    assert groq_service._is_prompt_like("photosynthesis")
    expanded = groq_service._expand_prompt_material("photosynthesis")
    assert "Topic: photosynthesis" in expanded


def test_short_real_note_is_not_treated_as_prompt():
    assert not groq_service._is_prompt_like("Cells divide to form new cells.")


def test_mixed_format_prompt_plan_honors_every_count():
    prompt = "Make/generate 5 multiple choice 10 identification and 10 true/false"
    ordered, counts = groq_service._parse_quiz_types(prompt)

    assert ordered == ["multiple_choice", "identification", "true_false"]
    assert counts == {
        "multiple_choice": 5,
        "identification": 10,
        "true_false": 10,
    }
    assert groq_service._resolve_quiz_plan(ordered, counts) == {
        "multiple_choice": 5,
        "identification": 10,
        "true_false": 10,
    }


def test_bare_topic_quiz_defaults_to_five_questions(monkeypatch):
    seen_prompts = []

    def fake_ai_json_call(prompt, **kwargs):
        seen_prompts.append(prompt)
        requested = int(re.search(r"Generate (\d+)", prompt).group(1))
        return [
            {
                "question": f"What is photosynthesis fact {i}?",
                "type": "multiple_choice",
                "options": ["A", "B", "C", "D"],
                "correctAnswer": 0,
                "explanation": "Because.",
                "bloomsLevel": "Understanding",
                "difficulty": "medium",
                "topicTag": "Photosynthesis",
            }
            for i in range(requested)
        ]

    monkeypatch.setattr(groq_service, "_ai_json_call", fake_ai_json_call)

    questions = groq_service.generate_quiz_with_groq(
        "photosynthesis",
        instructions="photosynthesis",
        require_count=True,
    )

    assert len(questions) == 5
    assert all(q["type"] == "multiple_choice" for q in questions)
    assert "photosynthesis" in seen_prompts[0].lower()

def test_explicit_per_format_quiz_counts_override_prompt(monkeypatch):
    requested = []

    def fake_ai_json_call(prompt, **kwargs):
        match = re.search(r'Generate exactly (\d+) .*?ALL of type "([^"]+)"', prompt)
        assert match, prompt
        count = int(match.group(1))
        qtype = match.group(2)
        requested.append((qtype, count))
        if qtype == "multiple_choice":
            return [
                {
                    "question": f"Which statement about photosynthesis is correct {i}?",
                    "type": "multiple_choice",
                    "options": ["A", "B", "C", "D"],
                    "correctAnswer": i % 4,
                    "explanation": "Because.",
                    "bloomsLevel": "Understanding",
                    "difficulty": "medium",
                    "topicTag": "Photosynthesis",
                }
                for i in range(count)
            ]
        if qtype == "true_false":
            return [
                {
                    "question": f"Photosynthesis uses light energy {i}.",
                    "type": "true_false",
                    "options": ["True", "False"],
                    "correctAnswer": 0,
                    "explanation": "Because.",
                    "bloomsLevel": "Understanding",
                    "difficulty": "medium",
                    "topicTag": "Photosynthesis",
                }
                for i in range(count)
            ]
        return [
            {
                "question": f"Identify the process {i}.",
                "type": "identification",
                "options": [],
                "correctAnswer": "Photosynthesis",
                "explanation": "Because.",
                "bloomsLevel": "Remembering",
                "difficulty": "medium",
                "topicTag": "Photosynthesis",
            }
            for i in range(count)
        ]

    monkeypatch.setattr(groq_service, "_ai_json_call", fake_ai_json_call)

    questions = groq_service.generate_quiz_with_groq(
        "Photosynthesis converts light energy into chemical energy in plants.",
        instructions="Make a quiz about photosynthesis.",
        quiz_counts={
            "multiple_choice": 2,
            "identification": 1,
            "true_false": 1,
        },
    )

    assert [q["type"] for q in questions] == [
        "multiple_choice",
        "multiple_choice",
        "identification",
        "true_false",
    ]
    assert requested == [
        ("multiple_choice", 2),
        ("identification", 1),
        ("true_false", 1),
    ]


def test_quiz_count_normalization_accepts_aliases_and_ignores_zero():
    assert groq_service._normalize_quiz_counts({
        "multipleChoice": 3,
        "true-false": "2",
        "identification": 0,
        "invalid": 9,
    }) == {"multiple_choice": 3, "true_false": 2}

def test_ai_limits_are_fifty():
    assert MAX_AI_QUESTIONS == 50
    assert MAX_AI_FLASHCARDS == 50


def test_quiz_plan_rejects_more_than_fifty_questions():
    with pytest.raises(groq_service.GroqAPIError) as exc:
        groq_service._resolve_quiz_plan(
            ["multiple_choice", "identification"],
            {"multiple_choice": 30, "identification": 21},
        )

    assert exc.value.code == "COUNT_EXCEEDS_MAX"
    assert "maximum of 50 questions" in exc.value.message
