"""Provider client implementations.

Every concrete provider accepts the API key via its constructor — there is
no module-level default that falls back to an owner-side env var. This
mirrors the production BYOK contract (see feedback-byok-from-day-one memory):
the customer always pays for their own API usage.
"""

from geosight_scanner.providers.base import ProviderClient, ProviderError
from geosight_scanner.providers.gemini_provider import GeminiClient
from geosight_scanner.providers.openai_provider import OpenAIClient
from geosight_scanner.providers.perplexity_provider import PerplexityClient

__all__ = [
    "GeminiClient",
    "OpenAIClient",
    "PerplexityClient",
    "ProviderClient",
    "ProviderError",
]
