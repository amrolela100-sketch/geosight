"""BYOK key resolution — env (dev) and vault (W13).

Why this layer exists:
    The provider clients (ProviderClient subclasses) require a non-empty api
    key at construction. The handler needs to fetch that key per (org,
    provider) pair WITHOUT baking in a single storage strategy — Phase 2
    runs in env-mode for the solo dev, Phase 3 (Week 13) swaps in the
    AES-256-GCM vault. Putting both behind one Protocol keeps the swap
    mechanical: change `WorkerConfig.byok_mode`, no handler edits.

BYOK contract reminder (see feedback_byok_from_day_one.md):
    The owner NEVER pays for a customer's API usage. EnvKeyResolver here is
    fine ONLY because in dev the developer IS the customer (single-tenant).
    The moment apps/api can write to api_keys_vault, env-mode must be
    flipped off in production.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Protocol, runtime_checkable

import httpx
import structlog

from geosight_scanner.types import ProviderName

from .config import VaultClientConfig

logger = structlog.get_logger(__name__)


class KeyResolutionError(RuntimeError):
    """Raised when no key is available for the requested provider/org."""

    def __init__(self, org_id: str, provider: ProviderName, reason: str) -> None:
        super().__init__(f"[{org_id}/{provider}] {reason}")
        self.org_id = org_id
        self.provider = provider
        self.reason = reason


@runtime_checkable
class KeyResolver(Protocol):
    """Returns a usable provider API key for `org_id`, or raises."""

    async def resolve(self, org_id: str, provider: ProviderName) -> str: ...

    async def close(self) -> None: ...


# Env var names we read in EnvKeyResolver mode. Kept here so README + tests
# share one source of truth.
_ENV_VAR_BY_PROVIDER: dict[ProviderName, str] = {
    ProviderName.OPENAI: "OPENAI_API_KEY",
    ProviderName.GEMINI: "GEMINI_API_KEY",
    ProviderName.PERPLEXITY: "PERPLEXITY_API_KEY",
}


class EnvKeyResolver:
    """Dev-only resolver — same key for every org. NOT for production.

    Flipping BYOK_MODE=vault in production is the safety switch: this
    resolver is never constructed in that path.
    """

    def __init__(self, env: dict[str, str] | None = None) -> None:
        # Accept an explicit dict for tests; default to live process env.
        self._env = env if env is not None else dict(os.environ)

    async def resolve(self, org_id: str, provider: ProviderName) -> str:
        env_var = _ENV_VAR_BY_PROVIDER[provider]
        value = self._env.get(env_var, "").strip()
        if not value:
            raise KeyResolutionError(
                org_id,
                provider,
                f"BYOK_MODE=env but {env_var} is unset. Either export the key "
                f"or switch the worker to BYOK_MODE=vault.",
            )
        return value

    async def close(self) -> None:
        return None


class VaultKeyResolver:
    """Production resolver — fetches cleartext keys from apps/api's
    decryption proxy (`POST /v1/internal/vault/decrypt`).

    The master key never leaves the api process. The Python worker holds
    decrypted keys only in-memory and only for `cache_ttl_seconds`. A
    process restart purges every cached secret.
    """

    def __init__(
        self,
        config: VaultClientConfig,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._config = config
        self._client = client or httpx.AsyncClient(
            base_url=config.api_base_url,
            timeout=httpx.Timeout(8.0, connect=4.0),
            headers={"X-Internal-Token": config.internal_token},
        )
        self._cache: dict[tuple[str, ProviderName], tuple[float, str]] = {}
        self._lock = asyncio.Lock()

    async def resolve(self, org_id: str, provider: ProviderName) -> str:
        key = (org_id, provider)
        now = time.monotonic()

        cached = self._cache.get(key)
        if cached:
            expires_at, value = cached
            if expires_at > now:
                return value
            # Stale — drop and refetch under lock so two concurrent jobs
            # don't both hit the proxy.
            self._cache.pop(key, None)

        async with self._lock:
            cached = self._cache.get(key)
            if cached and cached[0] > time.monotonic():
                return cached[1]

            value = await self._fetch(org_id, provider)
            expires_at = time.monotonic() + max(self._config.cache_ttl_seconds, 0)
            self._cache[key] = (expires_at, value)
            return value

    async def _fetch(self, org_id: str, provider: ProviderName) -> str:
        try:
            response = await self._client.post(
                "/v1/internal/vault/decrypt",
                json={"orgId": org_id, "provider": provider.value},
            )
        except httpx.TimeoutException as err:
            raise KeyResolutionError(
                org_id, provider, "timeout calling /v1/internal/vault/decrypt"
            ) from err
        except httpx.HTTPError as err:
            raise KeyResolutionError(
                org_id, provider, f"http error calling vault proxy: {err!r}"
            ) from err

        if response.status_code == 200:
            try:
                data = response.json()
            except ValueError as err:
                raise KeyResolutionError(
                    org_id, provider, "vault proxy returned non-json body"
                ) from err
            plaintext = data.get("plaintext")
            if not isinstance(plaintext, str) or not plaintext:
                raise KeyResolutionError(
                    org_id, provider, "vault proxy returned empty plaintext"
                )
            return plaintext

        if response.status_code == 401:
            raise KeyResolutionError(
                org_id, provider, "vault proxy rejected INTERNAL_SERVICE_TOKEN"
            )
        if response.status_code == 404:
            raise KeyResolutionError(
                org_id,
                provider,
                "no vault key configured for this org/provider — ask the org owner "
                "to add one in Settings.",
            )
        if response.status_code == 503:
            raise KeyResolutionError(
                org_id, provider, "vault unavailable (master key not configured?)"
            )

        raise KeyResolutionError(
            org_id,
            provider,
            f"unexpected status {response.status_code} from vault proxy",
        )

    async def close(self) -> None:
        await self._client.aclose()
        self._cache.clear()


def build_key_resolver(
    byok_mode: str, *, vault_config: VaultClientConfig | None = None
) -> KeyResolver:
    """Construct the right resolver for the configured BYOK mode."""
    if byok_mode == "env":
        return EnvKeyResolver()
    if byok_mode == "vault":
        if vault_config is None:
            raise ValueError(
                "BYOK_MODE=vault requires a VaultClientConfig — load_config() must "
                "have populated WorkerConfig.vault."
            )
        return VaultKeyResolver(vault_config)
    raise ValueError(f"Unsupported BYOK mode: {byok_mode!r}")
