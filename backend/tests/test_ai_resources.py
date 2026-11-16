"""AI resource save endpoints."""

from app import AIGeneratedContentModel, UserModel, db
from services import ai_content_service
from tests.conftest import auth_headers_for


def test_save_generated_flashcards_persists_deck(
    client, init_database, app_instance
):
    with app_instance.app_context():
        teacher = db.session.get(UserModel, "tea-1")
        headers = auth_headers_for(teacher)

    resp = client.post(
        "/api/ai/save",
        json={
            "id": "deck-test-1",
            "mode": "flashcards",
            "title": "Cell Biology Flashcards",
            "cards": [
                {"question": "What is a cell?", "answer": "The basic unit of life."}
            ],
        },
        headers=headers,
    )

    assert resp.status_code == 201, resp.get_data(as_text=True)
    data = resp.get_json()
    assert data["id"] == "deck-test-1"
    assert data["title"] == "Cell Biology Flashcards"
    assert data["cards"][0]["question"] == "What is a cell?"

    with app_instance.app_context():
        saved = db.session.get(AIGeneratedContentModel, "deck-test-1")
        assert saved is not None
        assert saved.generated_by == "tea-1"
        assert saved.content_type == "Flashcard"


def test_quiz_counts_payload_is_forwarded_to_generator(
    init_database, app_instance, monkeypatch
):
    captured = {}

    def fake_generate_quiz_with_groq(text_content, **kwargs):
        captured["text_content"] = text_content
        captured.update(kwargs)
        return [{
            "question": "What is photosynthesis?",
            "type": "multiple_choice",
            "options": ["A", "B", "C", "D"],
            "correctAnswer": 0,
            "explanation": "Because.",
            "bloomsLevel": "Understanding",
            "difficulty": "medium",
            "topicTag": "Photosynthesis",
        }]

    monkeypatch.setattr(ai_content_service, "generate_quiz_with_groq", fake_generate_quiz_with_groq)
    monkeypatch.setattr(ai_content_service, "generate_title_with_groq", lambda *args, **kwargs: "Generated Quiz")

    with app_instance.app_context():
        payload = ai_content_service._build_generated_resource(
            "quiz",
            {
                "title": "Custom Quiz",
                "quizCounts": {
                    "multiple_choice": "2",
                    "identification": "1",
                    "true_false": "1",
                },
            },
            "Photosynthesis converts light energy into chemical energy in plants.",
            "2026-01-01T00:00:00Z",
        )

    assert payload["title"] == "Custom Quiz"
    assert captured["quiz_counts"] == {
        "multiple_choice": "2",
        "identification": "1",
        "true_false": "1",
    }
    assert captured["num_questions"] == 4
    assert captured["require_count"] is False


def test_ai_generate_rejects_quiz_over_fifty(
    client, init_database, app_instance
):
    with app_instance.app_context():
        teacher = db.session.get(UserModel, "tea-1")
        headers = auth_headers_for(teacher)

    resp = client.post(
        "/api/ai/generate",
        json={
            "mode": "quiz",
            "text": "Photosynthesis converts light energy into chemical energy.",
            "quizCounts": {"multiple_choice": 51},
        },
        headers=headers,
    )

    assert resp.status_code == 400, resp.get_data(as_text=True)
    data = resp.get_json()
    assert data["code"] == "COUNT_EXCEEDS_MAX"
    assert "maximum of 50 questions" in data["error"]


def test_ai_generate_rejects_flashcards_over_fifty(
    client, init_database, app_instance
):
    with app_instance.app_context():
        teacher = db.session.get(UserModel, "tea-1")
        headers = auth_headers_for(teacher)

    resp = client.post(
        "/api/ai/generate",
        json={
            "mode": "flashcards",
            "text": "Photosynthesis converts light energy into chemical energy.",
            "flashcardCount": 51,
        },
        headers=headers,
    )

    assert resp.status_code == 400, resp.get_data(as_text=True)
    data = resp.get_json()
    assert data["code"] == "COUNT_EXCEEDS_MAX"
    assert "maximum of 50 flashcards" in data["error"]
