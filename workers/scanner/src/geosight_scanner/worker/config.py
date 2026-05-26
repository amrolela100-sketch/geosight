"""Env-backed worker configuration.

Kept dependency-light (stdlib only) — the worker boots from process env on
Railway/Fly/local, with `.env` resolution delegated to whoever launches it.

Required vars:
    DATABASE_URL  — postgres connection string (unpooled / direct).
    REDIS_URL     — BullMQ broker, e.g. rediss://default:...@upstash.

Optional vars:
    WORKER_CONCURRENCY    — bounded job concurrency (default 4).
    WORKER_QUEUES         — comma-separated subset of supported queues.
                            Default: "scan:manual,scan:scheduled".
    BYOK_MODE             — "env" (dev) | "vault" (W13). Default "env".
    LOG_LEVEL             — structlog level. Default "info".

The env-mode BYOK shortcut treats the developer running the worker as the
single tenant. It is INVALID in production once apps/api can stamp
encrypted_key into api_keys_vault (Week 13) — at that point flip to
BYOK_MODE=vault and the EnvKeyResolver will refuse to start.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

BYOKMode = Literal["env", "vault"]

SUPPORTED_QUEUES: tuple[str, ...] = ("scan:manual", "scan:scheduled")


class ConfigError(RuntimeError):
    """Raised at boot when a required env var is missing or malformed."""


@dataclass(frozen=True, slots=True)
class WorkerConfig:
    database_url: str
    redis_url: str
    queues: tuple[str, ...]
    concurrency: int
    byok_mode: BYOKMode
    log_level: str


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(
            f"{name} is required but missing. Set it in the environment before "
            f"launching the worker (see workers/scanner/README.md)."
        )
    return value


def _parse_queues(raw: str | None) -> tuple[str, ...]:
    default = ("scan:manual", "scan:scheduled")
    if not raw or not raw.strip():
        return default
    parsed = tuple(q.strip() for q in raw.split(",") if q.strip())
    invalid = [q for q in parsed if q not in SUPPORTED_QUEUES]
    if invalid:
        raise ConfigError(
            f"WORKER_QUEUES contains unsupported queues: {invalid}. "
            f"Allowed: {list(SUPPORTED_QUEUES)}."
        )
    return parsed or default


def _parse_concurrency(raw: str | None) -> int:
    if not raw:
        return 4
    try:
        value = int(raw)
    except ValueError as err:
        raise ConfigError(f"WORKER_CONCURRENCY must be an integer, got: {raw!r}") from err
    if value < 1 or value > 64:
        raise ConfigError(f"WORKER_CONCURRENCY must be between 1 and 64, got: {value}")
    return value


def _parse_byok_mode(raw: str | None) -> BYOKMode:
    value = (raw or "env").strip().lower()
    if value not in ("env", "vault"):
        raise ConfigError(f"BYOK_MODE must be 'env' or 'vault', got: {raw!r}")
    return value  # type: ignore[return-value]


def load_config() -> WorkerConfig:
    """Read worker config from process env. Raises ConfigError on bad input."""
    return WorkerConfig(
        database_url=_required("DATABASE_URL"),
        redis_url=_required("REDIS_URL"),
        queues=_parse_queues(os.environ.get("WORKER_QUEUES")),
        concurrency=_parse_concurrency(os.environ.get("WORKER_CONCURRENCY")),
        byok_mode=_parse_byok_mode(os.environ.get("BYOK_MODE")),
        log_level=(os.environ.get("LOG_LEVEL") or "info").strip().lower(),
    )
