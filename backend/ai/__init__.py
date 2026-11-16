"""AI generation package for StudyLens AI.

Provides access to AI generation functionality. Imports from groq_service for
backward compatibility; new code can import from either groq_service or this
package.

Modules:
- ai/client: Groq API client and rate limiting
- ai/prompts: Versioned prompt templates
- ai/generators: Per-generator modules (quiz, flashcards, summary, reviewer, recommendations, hints)
- ai/fallback: Offline content-derived generation fallback
"""

from groq_service import (
    GroqAPIError,
    GroqOfflineError,
    call_groq_ai,
    describe_image_with_groq,
    generate_title_with_groq,
    generate_quiz_with_groq,
    generate_flashcards_with_groq,
    generate_summary_with_groq,
    generate_reviewer_with_groq,
    generate_recommendations_with_groq,
    generate_hint_with_groq,
    explain_answer_with_groq,
    reset_generation_source,
    generation_used_fallback,
    mark_offline_fallback,
    _build_quiz_fallback,
    _build_flashcards_fallback,
    _build_summary_fallback,
    _build_reviewer_fallback,
    _question_hint_fallback,
)

__all__ = [
    "GroqAPIError",
    "GroqOfflineError",
    "call_groq_ai",
    "describe_image_with_groq",
    "generate_title_with_groq",
    "generate_quiz_with_groq",
    "generate_flashcards_with_groq",
    "generate_summary_with_groq",
    "generate_reviewer_with_groq",
    "generate_recommendations_with_groq",
    "generate_hint_with_groq",
    "explain_answer_with_groq",
    "reset_generation_source",
    "generation_used_fallback",
    "mark_offline_fallback",
    "_build_quiz_fallback",
    "_build_flashcards_fallback",
    "_build_summary_fallback",
    "_build_reviewer_fallback",
    "_question_hint_fallback",
]
