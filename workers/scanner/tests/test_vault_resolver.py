"""VaultKeyResolver tests — uses httpx MockTransport so we don't hit a real api."""

from __future__ import annotations

import asyncio
from typing import Any

import httpx
import pytest

from geosight_scanner.types import ProviderName
from geosight_scanner.worker.config import VaultClientConfig
from geosight_scanner.worker.keys import (
    KeyResolutionError,
    VaultKeyResolver,
)


def _config(ttl: int = 600) -> VaultClientConfig:
    return VaultClientConfig(
        api_base_url="https://api.test",
        internal_token="shared-secret",
        cache_ttl_seconds=ttl,
    )


def _resolver(handler: Any, *, ttl: int = 600) -> VaultKeyResolver:
    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(
        base_url="https://api.test",
        transport=transport,
        headers={"X-Internal-Token": "shared-secret"},
    )
    return VaultKeyResolver(_config(ttl), client=client)


@pytest.mark.asyncio
async def test_resolve_returns_plaintext_on_200() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"ok": True, "plaintext": "sk-org1-openai"})

    resolver = _resolver(handler)
    try:
        value = await resolver.resolve("org-1", ProviderName.OPENAI)
        assert value == "sk-org1-openai"
        assert len(seen) == 1
        # X-Internal-Token must be sent
        assert seen[0].headers["X-Internal-Token"] == "shared-secret"
    finally:
        await resolver.close()


@pytest.mark.asyncio
async def test_resolve_caches_within_ttl() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"plaintext": f"sk-{calls}"})

    resolver = _resolver(handler, ttl=600)
    try:
        a = await resolver.resolve("org-1", ProviderName.OPENAI)
        b = await resolver.resolve("org-1", ProviderName.OPENAI)
        assert a == b == "sk-1"
        assert calls == 1
    finally:
        await resolver.close()


@pytest.mark.asyncio
async def test_resolve_does_not_share_cache_across_orgs_or_providers() -> None:
    calls: list[tuple[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = request.read()
        import json as _json

        parsed = _json.loads(body)
        calls.append((parsed["orgId"], parsed["provider"]))
        return httpx.Response(200, json={"plaintext": f"sk-{parsed['provider']}"})

    resolver = _resolver(handler)
    try:
        await resolver.resolve("org-1", ProviderName.OPENAI)
        await resolver.resolve("org-2", ProviderName.OPENAI)
        await resolver.resolve("org-1", ProviderName.GEMINI)
        assert len(calls) == 3
    finally:
        await resolver.close()


@pytest.mark.asyncio
async def test_resolve_maps_401_to_KeyResolutionError() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "Unauthorized"})

    resolver = _resolver(handler)
    try:
        with pytest.raises(KeyResolutionError, match="INTERNAL_SERVICE_TOKEN"):
            await resolver.resolve("org-1", ProviderName.OPENAI)
    finally:
        await resolver.close()


@pytest.mark.asyncio
async def test_resolve_maps_404_to_KeyResolutionError() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "KeyNotFound"})

    resolver = _resolver(handler)
    try:
        with pytest.raises(KeyResolutionError, match="no vault key configured"):
            await resolver.resolve("org-1", ProviderName.OPENAI)
    finally:
        await resolver.close()


@pytest.mark.asyncio
async def test_resolve_maps_503_to_KeyResolutionError() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": "VaultUnavailable"})

    resolver = _resolver(handler)
    try:
        with pytest.raises(KeyResolutionError, match="vault unavailable"):
            await resolver.resolve("org-1", ProviderName.OPENAI)
    finally:
        await resolver.close()


@pytest.mark.asyncio
async def test_resolve_rejects_empty_plaintext() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"plaintext": ""})

    resolver = _resolver(handler)
    try:
        with pytest.raises(KeyResolutionError, match="empty plaintext"):
            await resolver.resolve("org-1", ProviderName.OPENAI)
    finally:
        await resolver.close()


@pytest.mark.asyncio
async def test_concurrent_resolves_do_not_double_fetch() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"plaintext": "sk-concurrent"})

    resolver = _resolver(handler)
    try:
        results = await asyncio.gather(
            *(resolver.resolve("org-1", ProviderName.OPENAI) for _ in range(10))
        )
        assert all(r == "sk-concurrent" for r in results)
        # The single-flight lock ensures we hit the proxy at most once even
        # with 10 concurrent resolvers in the same TTL window.
        assert calls == 1
    finally:
        await resolver.close()
