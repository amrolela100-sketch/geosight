"""OpenAI (ChatGPT) provider adapter — Phase 0.

Uses the Chat Completions endpoint with gpt-4o-mini for cost. The Arabic
system prompt nudges the model toward dialect-aware, citation-rich answers.
"""

from __future__ import annotations

from datetime import UTC, datetime
from time import perf_counter
from typing import Any

import httpx

from geosight_scanner.providers.base import ProviderClient, ProviderError
from geosight_scanner.types import ProviderName, ProviderResponse

_ENDPOINT = "https://api.openai.com/v1/chat/completions"
_MODEL = "gpt-4o-mini"
_SYSTEM_PROMPT = (
    "أنت مساعد عربي متخصص في تقديم توصيات دقيقة عن الشركات والخدمات في "
    "المنطقة العربية. أجب بنفس لهجة السؤال (فصحى/خليجي/شامي/مصري). "
    "اذكر الشركات بأسمائها التجارية المعروفة، وأضف روابط مصادر موثوقة "
    "(URLs) عند توفرها."
)


class OpenAIClient(ProviderClient):
    name = ProviderName.OPENAI

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

        return ProviderResponse(
            provider=self.name,
            text=text,
            citations=(),  # OpenAI Chat Completions doesn't surface citations natively
            latency_ms=latency_ms,
            fetched_at=datetime.now(UTC),
            raw=body,
        )
