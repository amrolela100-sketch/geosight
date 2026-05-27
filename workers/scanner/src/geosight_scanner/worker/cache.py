"""Provider response cache for scan jobs.

The cache stores normalized ProviderResponse objects, never API keys. Keys are
scoped by organization + provider + prompt so one tenant cannot observe another
tenant's raw provider output.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Protocol

from redis.asyncio import Redis

from geosight_scanner.types import ProviderName, ProviderResponse

_CACHE_SCHEMA_VERSION = 1
_DEFAULT_NAMESPACE = "geosight:scanner-response"


class ResponseCache(Protocol):
    async def get(
        self, *, org_id: str, provider: ProviderName, prompt: str
    ) -> ProviderResponse | None: ...

    async def set(
        self,
        *,
        org_id: str,
        provider: ProviderName,
        prompt: str,
        response: ProviderResponse,
    ) -> None: ...

    async def close(self) -> None: ...


class NullResponseCache:
    async def get(
        self, *, org_id: str, provider: ProviderName, prompt: str
    ) -> ProviderResponse | None:
        return None

    async def set(
        self, *, org_id: str, provider: ProviderName, prompt: str, response: ProviderResponse
    ) -> None:
        return None

    async def close(self) -> None:
        return None


class RedisResponseCache:
    def __init__(
        self,
        redis: Redis,
        *,
        ttl_seconds: int,
        namespace: str = _DEFAULT_NAMESPACE,
    ) -> None:
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive")
        self._redis = redis
        self._ttl_seconds = ttl_seconds
        self._namespace = namespace

    @classmethod
    def from_url(cls, redis_url: str, *, ttl_seconds: int) -> RedisResponseCache:
        return cls(Redis.from_url(redis_url, decode_responses=True), ttl_seconds=ttl_seconds)

    def _key(self, *, org_id: str, provider: ProviderName, prompt: str) -> str:
        material = json.dumps(
            {
                "schema": _CACHE_SCHEMA_VERSION,
                "orgId": org_id,
                "provider": provider.value,
                "prompt": prompt,
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        digest = hashlib.sha256(material.encode("utf-8")).hexdigest()
        return f"{self._namespace}:v{_CACHE_SCHEMA_VERSION}:{digest}"

    async def get(
        self, *, org_id: str, provider: ProviderName, prompt: str
    ) -> ProviderResponse | None:
        cached = await self._redis.get(self._key(org_id=org_id, provider=provider, prompt=prompt))
        if cached is None:
            return None
        if not isinstance(cached, str):
            return None
        return _deserialize_response(cached)

    async def set(
        self, *, org_id: str, provider: ProviderName, prompt: str, response: ProviderResponse
    ) -> None:
        await self._redis.set(
            self._key(org_id=org_id, provider=provider, prompt=prompt),
            _serialize_response(response),
            ex=self._ttl_seconds,
        )

    async def close(self) -> None:
        await self._redis.aclose()


def _serialize_response(response: ProviderResponse) -> str:
    return json.dumps(
        {
            "schema": _CACHE_SCHEMA_VERSION,
            "provider": response.provider.value,
            "text": response.text,
            "citations": list(response.citations),
            "latencyMs": response.latency_ms,
            "fetchedAt": response.fetched_at.isoformat(),
            "raw": response.raw,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def _deserialize_response(payload: str) -> ProviderResponse:
    data: dict[str, Any] = json.loads(payload)
    if data.get("schema") != _CACHE_SCHEMA_VERSION:
        raise ValueError("unsupported response cache schema")
    raw = data.get("raw")
    if not isinstance(raw, dict):
        raw = {}
    citations = data.get("citations")
    if not isinstance(citations, list):
        citations = []
    return ProviderResponse(
        provider=ProviderName(str(data["provider"])),
        text=str(data["text"]),
        citations=tuple(c for c in citations if isinstance(c, str)),
        latency_ms=int(data["latencyMs"]),
        fetched_at=datetime.fromisoformat(str(data["fetchedAt"])),
        raw=raw,
    )
