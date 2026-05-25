"""Google Gemini provider adapter — Phase 0.

Uses the Generative Language API v1beta. Gemini 1.5 Flash is the cost-conscious
default; the customer can override per-org in Phase 3.
"""

from __future__ import annotations

from datetime import UTC, datetime
from time import perf_counter
from typing import Any

import httpx

from geosight_scanner.providers.base import ProviderClient, ProviderError
from geosight_scanner.types import ProviderName, ProviderResponse

_MODEL = "gemini-1.5-flash"
_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{_MODEL}:generateContent"
_SYSTEM_INSTRUCTION = (
    "أنت مساعد عربي متخصص في تقديم توصيات دقيقة عن الشركات والخدمات في "
    "المنطقة العربية. أجب بنفس لهجة السؤال، واذكر الشركات بأسمائها التجارية "
    "المعروفة، وأضف روابط مصادر موثوقة عند توفرها."
)


class GeminiClient(ProviderClient):
    name = ProviderName.GEMINI

    async def query(self, prompt: str) -> ProviderResponse:
        payload: dict[str, Any] = {
            "system_instruction": {"parts": [{"text": _SYSTEM_INSTRUCTION}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3},
        }
        params = {"key": self._api_key}

        started = perf_counter()
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(_ENDPOINT, params=params, json=payload)
        latency_ms = int((perf_counter() - started) * 1000)

        if response.status_code != 200:
            raise ProviderError(
                self.name,
                f"HTTP {response.status_code}: {response.text[:200]}",
                status=response.status_code,
            )

        body = response.json()
        try:
            candidate = body["candidates"][0]
            text_parts: list[str] = []
            for part in candidate["content"]["parts"]:
                if "text" in part:
                    text_parts.append(part["text"])
            text = "".join(text_parts)
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError(self.name, f"unexpected response shape: {exc}") from exc

        # Gemini surfaces grounding metadata when search is enabled — capture
        # any URIs it provides as citations.
        citations: tuple[str, ...] = ()
        grounding = body.get("candidates", [{}])[0].get("groundingMetadata", {})
        if isinstance(grounding, dict):
            chunks = grounding.get("groundingChunks") or []
            urls: list[str] = []
            for chunk in chunks:
                web = chunk.get("web") if isinstance(chunk, dict) else None
                if isinstance(web, dict) and isinstance(web.get("uri"), str):
                    urls.append(web["uri"])
            citations = tuple(urls)

        return ProviderResponse(
            provider=self.name,
            text=text,
            citations=citations,
            latency_ms=latency_ms,
            fetched_at=datetime.now(UTC),
            raw=body,
        )
