"""Response cache tests — Null + Redis variants.

The Redis path is exercised with an in-memory fake that mimics the subset of
the asyncio Redis client the cache touches (`get`, `set`, `aclose`). We don't
spin up a real Redis here — that belongs in an integration suite.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from geosight_scanner.types import ProviderName, ProviderResponse
from geosight_scanner.worker.cache import (
    NullResponseCache,
    RedisResponseCache,
)

ORG_ID = "11111111-1111-1111-1111-111111111111"
PROMPT = "ما أفضل علامة تلفزيونات؟"


def _response() -> ProviderResponse:
    return ProviderResponse(
        provider=ProviderName.OPENAI,
        text="نوصي بـ سامسونج.",
        citations=("https://example.com",),
        latency_ms=42,
        fetched_at=datetime(2026, 5, 27, 12, 0, tzinfo=UTC),
        raw={"prompt": PROMPT},
    )


class FakeRedis:
    """Minimal asyncio Redis fake — just enough surface for RedisResponseCache."""

    def __init__(self) -> None:
        self.store: dict[str, tuple[str, int | None]] = {}
        self.closed = False

    async def get(self, key: str) -> str | None:
        record = self.store.get(key)
        return record[0] if record else None

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.store[key] = (value, ex)

    async def aclose(self) -> None:
        self.closed = True


# ─────────────────────────────────────────────────────────────────────────────
# NullResponseCache
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_null_cache_always_misses() -> None:
    cache = NullResponseCache()
    result = await cache.get(org_id=ORG_ID, provider=ProviderName.OPENAI, prompt=PROMPT)
    assert result is None


@pytest.mark.asyncio
async def test_null_cache_set_is_a_noop() -> None:
    cache = NullResponseCache()
    await cache.set(
        org_id=ORG_ID,
        provider=ProviderName.OPENAI,
        prompt=PROMPT,
        response=_response(),
    )
    # Still misses after set — proves it's a no-op store.
    assert (
        await cache.get(org_id=ORG_ID, provider=ProviderName.OPENAI, prompt=PROMPT)
    ) is None


# ─────────────────────────────────────────────────────────────────────────────
# RedisResponseCache
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_redis_cache_rejects_non_positive_ttl() -> None:
    fake = FakeRedis()
    with pytest.raises(ValueError, match="positive"):
        RedisResponseCache(fake, ttl_seconds=0)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_redis_cache_round_trip_preserves_response() -> None:
    fake = FakeRedis()
    cache = RedisResponseCache(fake, ttl_seconds=120)  # type: ignore[arg-type]
    original = _response()

    await cache.set(
        org_id=ORG_ID,
        provider=ProviderName.OPENAI,
        prompt=PROMPT,
        response=original,
    )
    cached = await cache.get(
        org_id=ORG_ID, provider=ProviderName.OPENAI, prompt=PROMPT
    )

    assert cached is not None
    assert cached.provider == original.provider
    assert cached.text == original.text
    assert cached.citations == original.citations
    assert cached.latency_ms == original.latency_ms
    assert cached.fetched_at == original.fetched_at
    assert cached.raw == original.raw


@pytest.mark.asyncio
async def test_redis_cache_applies_ttl_on_set() -> None:
    fake = FakeRedis()
    cache = RedisResponseCache(fake, ttl_seconds=300)  # type: ignore[arg-type]
    await cache.set(
        org_id=ORG_ID,
        provider=ProviderName.OPENAI,
        prompt=PROMPT,
        response=_response(),
    )
    # The cache wrote with `ex=300` — the FakeRedis records ttl alongside value.
    (_, ttl) = next(iter(fake.store.values()))
    assert ttl == 300


@pytest.mark.asyncio
async def test_redis_cache_namespaces_keys_per_org_provider_prompt() -> None:
    fake = FakeRedis()
    cache = RedisResponseCache(fake, ttl_seconds=60)  # type: ignore[arg-type]

    await cache.set(
        org_id="org-a",
        provider=ProviderName.OPENAI,
        prompt=PROMPT,
        response=_response(),
    )
    await cache.set(
        org_id="org-b",
        provider=ProviderName.OPENAI,
        prompt=PROMPT,
        response=_response(),
    )
    await cache.set(
        org_id="org-a",
        provider=ProviderName.GEMINI,
        prompt=PROMPT,
        response=_response(),
    )
    await cache.set(
        org_id="org-a",
        provider=ProviderName.OPENAI,
        prompt="different prompt",
        response=_response(),
    )

    # All four scopes produce distinct keys — no cross-tenant collision.
    assert len(fake.store) == 4


@pytest.mark.asyncio
async def test_redis_cache_returns_none_on_miss() -> None:
    fake = FakeRedis()
    cache = RedisResponseCache(fake, ttl_seconds=60)  # type: ignore[arg-type]
    result = await cache.get(
        org_id=ORG_ID, provider=ProviderName.OPENAI, prompt=PROMPT
    )
    assert result is None


@pytest.mark.asyncio
async def test_redis_cache_rejects_unknown_schema() -> None:
    fake = FakeRedis()
    cache = RedisResponseCache(fake, ttl_seconds=60)  # type: ignore[arg-type]
    # Hand-craft an entry with a stale schema version so the cache refuses it.
    key = cache._key(
        org_id=ORG_ID, provider=ProviderName.OPENAI, prompt=PROMPT
    )
    fake.store[key] = ('{"schema":99,"provider":"openai","text":"x"}', 60)
    with pytest.raises(ValueError, match="schema"):
        await cache.get(
            org_id=ORG_ID, provider=ProviderName.OPENAI, prompt=PROMPT
        )


@pytest.mark.asyncio
async def test_redis_cache_close_closes_underlying_client() -> None:
    fake = FakeRedis()
    cache = RedisResponseCache(fake, ttl_seconds=60)  # type: ignore[arg-type]
    await cache.close()
    assert fake.closed is True


@pytest.mark.asyncio
async def test_redis_cache_handles_non_string_payload() -> None:
    """Defensive: if Redis somehow returns bytes/None types we don't crash."""
    fake = FakeRedis()
    cache = RedisResponseCache(fake, ttl_seconds=60)  # type: ignore[arg-type]
    key = cache._key(
        org_id=ORG_ID, provider=ProviderName.OPENAI, prompt=PROMPT
    )

    class WeirdRedis:
        async def get(self, _key: str) -> Any:
            return 42  # not a string

        async def set(self, *args: Any, **kwargs: Any) -> None:
            return None

        async def aclose(self) -> None:
            return None

    cache2 = RedisResponseCache(WeirdRedis(), ttl_seconds=60)  # type: ignore[arg-type]
    assert (
        await cache2.get(org_id=ORG_ID, provider=ProviderName.OPENAI, prompt=PROMPT)
    ) is None
    # The key constant is unused after the WeirdRedis swap but keeps the
    # boundary visible for future readers.
    _ = key
