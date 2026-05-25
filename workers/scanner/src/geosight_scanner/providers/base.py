"""Provider client interface — the BYOK contract.

Phase 0 covers only the happy path. Phase 2 adds retry + backoff + Redis
cache around this same interface (see docs/ROADMAP.md § Week 8-9).
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from geosight_scanner.types import ProviderName, ProviderResponse


class ProviderError(RuntimeError):
    """Raised when a provider returns a non-recoverable error."""

    def __init__(self, provider: ProviderName, message: str, *, status: int | None = None) -> None:
        super().__init__(f"[{provider}] {message}")
        self.provider = provider
        self.status = status


class ProviderClient(ABC):
    """Common interface every provider adapter implements.

    The `api_key` is REQUIRED at construction. There is no fallback to an
    owner-side env var inside the client itself — the caller is responsible
    for sourcing the key (from the BYOK vault in production, from .env in
    the dev spike). This guarantees the owner never accidentally pays for
    a customer's scan.
    """

    #: Concrete subclasses set this to the matching ProviderName enum value.
    name: ProviderName

    def __init__(self, api_key: str, *, timeout_seconds: float = 30.0) -> None:
        if not api_key or not api_key.strip():
            raise ValueError(
                f"{type(self).__name__} requires a non-empty api_key — "
                "the BYOK contract has no owner-side fallback."
            )
        self._api_key = api_key.strip()
        self._timeout = timeout_seconds

    @abstractmethod
    async def query(self, prompt: str) -> ProviderResponse:
        """Send `prompt` to the provider and return its normalized response."""
        raise NotImplementedError
