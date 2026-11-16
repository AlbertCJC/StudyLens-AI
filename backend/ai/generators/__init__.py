"""AI content generators package.

Each generator module handles a specific type of AI-generated content:
- quiz: Quiz generation with multiple-choice questions
- flashcards: Flashcard generation
- summary: Summary generation
- reviewer: Study reviewer generation
- recommendations: Learning recommendations
- hints: Hints and explanations
"""

from .quiz import generate_quiz_with_groq
from .flashcards import generate_flashcards_with_groq
from .summary import generate_summary_with_groq
from .reviewer import generate_reviewer_with_groq
from .recommendations import generate_recommendations_with_groq
from .hints import generate_hint_with_groq, explain_answer_with_groq

__all__ = [
    "generate_quiz_with_groq",
    "generate_flashcards_with_groq",
    "generate_summary_with_groq",
    "generate_reviewer_with_groq",
    "generate_recommendations_with_groq",
    "generate_hint_with_groq",
    "explain_answer_with_groq",
]
