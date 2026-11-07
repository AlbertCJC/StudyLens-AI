"""Student analytics and learning-profile aggregation."""

import json

from extensions import db
from lib.validation import _json_loads
from models import (
    AIGeneratedContentModel,
    MaterialModel,
    QuizAttemptModel,
    QuizModel,
    StudentProgressModel,
)

MASTERY_THRESHOLD = 70

def _build_student_learning_profile(student_id, subject_id=None):
    """Aggregates quiz attempt analytics + progress into a profile for the AI advisor."""
    profile = {
        "studentId": student_id,
        "subjectId": subject_id,
        "subjectName": "General",
        "averageScore": 0.0,
        "completionPercentage": 0.0,
        "learningLevel": "Beginner",
        "attemptCount": 0,
        "weakTopics": [],
        "strongTopics": [],
        "lastActivity": ""
    }
    try:
        attempts_q = QuizAttemptModel.query.filter_by(student_id=student_id)
        if subject_id:
            attempts_q = attempts_q.filter_by(subject_id=subject_id)
        attempts = attempts_q.all()
        if attempts:
            scores = [a.percentage for a in attempts]
            profile["averageScore"] = round(sum(scores) / len(scores), 1)
            profile["attemptCount"] = len(attempts)
            profile["lastActivity"] = attempts[0].submitted_at
            weak_counts = {}
            strong_counts = {}
            for a in attempts:
                for t in _json_loads(a.weak_topics_json):
                    weak_counts[t] = weak_counts.get(t, 0) + 1
                for t in _json_loads(a.strong_topics_json):
                    strong_counts[t] = strong_counts.get(t, 0) + 1
            profile["weakTopics"] = sorted(weak_counts, key=weak_counts.get, reverse=True)[:5]
            profile["strongTopics"] = sorted(strong_counts, key=strong_counts.get, reverse=True)[:5]
            prog_res = StudentProgressModel.query.filter_by(student_id=student_id)
            if subject_id:
                prog_res = prog_res.filter_by(subject_id=subject_id)
            prog = prog_res.first()
            if prog:
                profile["completionPercentage"] = prog.completion_percentage or 0.0
                profile["learningLevel"] = prog.learning_level or "Intermediate"
    except Exception as e:
        print("[Database] Could not build learning profile:", e)
    return profile


def _quiz_topic_index():
    """topicTag lookup from questionId using all persisted quizzes."""
    index = {}
    for qz in QuizModel.query.all():
        try:
            for q in json.loads(qz.questions_json):
                index[str(q.get("id"))] = q.get("topicTag") or "General Concepts"
        except Exception:
            continue
    return index


def _aggregate_topic_performance(attempts):
    """topic -> {total, correct, accuracyPercentage} from persisted quiz attempts."""
    topic_index = _quiz_topic_index()
    topic_map = {}
    for att in attempts:
        try:
            answers = json.loads(att.answers_json)
        except Exception:
            answers = []
        for ans in answers:
            topic = topic_index.get(str(ans.get("questionId")), "General Concepts")
            entry = topic_map.setdefault(topic, {"total": 0, "correct": 0})
            entry["total"] += 1
            if ans.get("isCorrect"):
                entry["correct"] += 1
    for t, d in topic_map.items():
        d["accuracyPercentage"] = round((d["correct"] / d["total"]) * 100) if d["total"] else 0
    return topic_map


def _first_match_for_topic(topic):
    """Best-effort lookups of study content tied to a topic (first match wins).

    Searches the persisted library directly: a quiz whose questions carry the
    topic tag, a material whose title/description mentions the topic, and any
    flashcard/reviewer decks whose titles match. Plain dict output (safe for
    jsonify).
    """
    needle = (topic or "").strip().lower()

    def topic_tags(questions):
        tags = set()
        for q in questions or []:
            tags.add((q.get("topicTag") or "General Concepts").strip().lower())
        return tags

    material = None
    for mat in MaterialModel.query.all():
        if needle and (needle in (mat.title or "").lower() or needle in (mat.description or "").lower()):
            material = mat
            break

    quiz = None
    for qz in QuizModel.query.all():
        try:
            tags = topic_tags(json.loads(qz.questions_json))
        except Exception:
            continue
        if needle in tags:
            quiz = qz
            break

    def ai_match(content_type):
        for entry in AIGeneratedContentModel.query.filter_by(content_type=content_type).all():
            if needle in (entry.title or "").lower():
                return entry
        return None

    flashcard = ai_match("Flashcard")
    reviewer = ai_match("Reviewer")

    return {
        "material": {"id": material.material_id, "title": material.title} if material else None,
        "flashcardId": flashcard.content_id if flashcard else None,
        "reviewerId": reviewer.content_id if reviewer else None,
        "quiz": (
            {"id": quiz.quiz_id, "title": quiz.title, "difficulty": quiz.difficulty, "subjectId": quiz.subject_id}
            if quiz else None
        ),
        "subjectId": quiz.subject_id if quiz else (material.subject_id if material else None),
    }


def _latest_attempt_percentages(attempts):
    """Return the percentage of the MOST RECENT attempt per quiz.

    Grading policy: when a quiz is retaken, the recorded score is the latest
    attempt only — earlier attempts never dilute the student's average.
    Accepts model instances or to_dict() mappings.
    """
    def _get(item, name):
        return item.get(name) if isinstance(item, dict) else getattr(item, name)

    latest = {}
    for a in sorted(attempts, key=lambda x: (_get(x, "submitted_at") or ""), reverse=True):
        qid = _get(a, "quiz_id")
        if qid not in latest:
            latest[qid] = float(_get(a, "percentage") or 0)
    return list(latest.values())


def _accuracy_before_latest_tagged_attempt(attempts, topic):
    """Accuracy across all attempts BEFORE the latest one that tagged ``topic``
    weak/strong. ``attempts`` must be sorted newest-first. Returns None when the
    topic was never tagged or has no comparable earlier data."""
    for idx, att in enumerate(attempts):
        try:
            tags = json.loads(att.weak_topics_json or "[]") + json.loads(att.strong_topics_json or "[]")
        except Exception:
            continue
        if topic in tags:
            earlier = attempts[idx + 1:]
            if not earlier:
                return None
            stats = _aggregate_topic_performance(earlier).get(topic)
            return stats.get("accuracyPercentage") if stats else None
    return None
