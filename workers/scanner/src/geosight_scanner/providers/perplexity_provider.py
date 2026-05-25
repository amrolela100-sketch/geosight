"""Perplexity provider adapter — Phase 0.

Perplexity is the citation powerhouse: every response includes a list of
source URLs. We expose them directly via ProviderResponse.citations.
"""

from __future__ import annotations

from datetime import UTC, datetime
from time import perf_counter
from typing import Any

import httpx

from geosight_scanner.providers.base import ProviderClient, ProviderError
from geosight_scanner.types import ProviderName, ProviderResponse

_ENDPOINT = "https://api.perplexity.ai/chat/completions"
_MODEL = "llama-3.1-sonar-small-128k-online"
_SYSTEM_PROMPT = (
    "You are an Arabic-fluent research assistant. Always respond in the "
    "dialect of the user's question (MSA / Gulf / Levantine / Egyptian). "
    "Mention companies by their commonly-used trade names and include "
    "source URLs when relevant."
)


class PerplexityClient(ProviderClient):
    name = ProviderName.PERPLEXITY

    async def query(self, prompt: str) -> ProviderResponse:
        payload: dict[str, Any] = {
            "model": _MODEL,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        started = perf_counter()
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(_ENDPOINT, json=payload, headers=headers)
        latency_ms = int((perf_counter() - started) * 1000)

        if response.status_code != 200:
            raise ProviderError(
                self.name,
                f"HTTP {response.status_code}: {response.text[:200]}",
                status=response.status_code,
            )

        body = response.json()
        try:
            text = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError(self.name, f"unexpected response shape: {exc}") from exc

        citations_raw = body.get("citations") or []
        citations = tuple(c for c in citations_raw if isinstance(c, str))

        return ProviderResponse(
            provider=self.name,
            text=text,
            citations=citations,
            latency_ms=latency_ms,
            fetched_at=datetime.now(UTC),
            raw=body,
        )
