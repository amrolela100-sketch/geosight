"""BYOK key resolution — env (dev) and vault (W13 stub).

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

import os
from typing import Protocol, runtime_checkable

from geosight_scanner.types import ProviderName


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
    """Production resolver — reads encrypted_key from api_keys_vault.

    Implemented in Week 13 once KeyVaultService lands on the TS side and the
    Python worker can borrow the same master key (or a derived per-worker
    key) over a secrets manager. Constructing this in W8 is a footgun —
    raise loudly so we don't accidentally ship without the crypto path.
    """

    def __init__(self) -> None:
        raise NotImplementedError(
            "VaultKeyResolver is not implemented yet (planned Week 13 — see "
            "implementation_plan_new.md § Phase 3). Use BYOK_MODE=env for now."
        )

    async def resolve(self, org_id: str, provider: ProviderName) -> str:  # pragma: no cover
        raise NotImplementedError

    async def close(self) -> None:  # pragma: no cover
        return None


def build_key_resolver(byok_mode: str) -> KeyResolver:
    """Construct the right resolver for the configured BYOK mode."""
    if byok_mode == "env":
        return EnvKeyResolver()
    if byok_mode == "vault":
        return VaultKeyResolver()
    raise ValueError(f"Unsupported BYOK mode: {byok_mode!r}")
