"""Client module for AI generation - re-exports from groq_service for backward compatibility.

New code can import from groq_service directly or from ai.client.
"""

from groq_service import (
    GroqAPIError,
    GroqOfflineError,
    call_groq_ai,
    describe_image_with_groq,
    generate_title_with_groq,
    reset_generation_source,
    generation_used_fallback,
    mark_offline_fallback,
)

__all__ = [
    "GroqAPIError",
    "GroqOfflineError",
    "call_groq_ai",
    "describe_image_with_groq",
    "generate_title_with_groq",
    "reset_generation_source",
    "generation_used_fallback",
    "mark_offline_fallback",
]
