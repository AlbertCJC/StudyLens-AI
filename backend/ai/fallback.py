"""Fallback content generation - re-exports from groq_service."""

from groq_service import (
    _build_quiz_fallback,
    _build_flashcards_fallback,
    _build_summary_fallback,
    _build_reviewer_fallback,
    _question_hint_fallback,
)

__all__ = [
    "_build_quiz_fallback",
    "_build_flashcards_fallback",
    "_build_summary_fallback",
    "_build_reviewer_fallback",
    "_question_hint_fallback",
]
