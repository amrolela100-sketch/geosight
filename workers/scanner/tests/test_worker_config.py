"""Worker config + key-resolver wiring tests."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from geosight_scanner.worker.config import ConfigError, load_config
from geosight_scanner.worker.keys import (
    EnvKeyResolver,
    VaultKeyResolver,
    build_key_resolver,
)


def test_load_config_requires_database_url() -> None:
    with patch.dict(os.environ, {"REDIS_URL": "redis://x"}, clear=True):
        with pytest.raises(ConfigError) as err:
            load_config()
        assert "DATABASE_URL" in str(err.value)


def test_load_config_requires_redis_url() -> None:
    with patch.dict(os.environ, {"DATABASE_URL": "postgres://x"}, clear=True):
        with pytest.raises(ConfigError) as err:
            load_config()
        assert "REDIS_URL" in str(err.value)


def test_load_config_defaults() -> None:
    with patch.dict(
        os.environ,
        {"DATABASE_URL": "postgres://x", "REDIS_URL": "redis://x"},
        clear=True,
    ):
        config = load_config()
    assert config.queues == ("scan:manual", "scan:scheduled")
    assert config.concurrency == 4
    assert config.byok_mode == "env"
    assert config.log_level == "info"


def test_load_config_parses_queue_subset() -> None:
    with patch.dict(
        os.environ,
        {
            "DATABASE_URL": "postgres://x",
            "REDIS_URL": "redis://x",
            "WORKER_QUEUES": "scan:manual",
        },
        clear=True,
    ):
        config = load_config()
    assert config.queues == ("scan:manual",)


def test_load_config_rejects_unknown_queue() -> None:
    with patch.dict(
        os.environ,
        {
            "DATABASE_URL": "postgres://x",
            "REDIS_URL": "redis://x",
            "WORKER_QUEUES": "scan:manual,bogus",
        },
        clear=True,
    ):
        with pytest.raises(ConfigError):
            load_config()


def test_load_config_rejects_concurrency_outside_bounds() -> None:
    with patch.dict(
        os.environ,
        {
            "DATABASE_URL": "postgres://x",
            "REDIS_URL": "redis://x",
            "WORKER_CONCURRENCY": "0",
        },
        clear=True,
    ):
        with pytest.raises(ConfigError):
            load_config()


def test_build_key_resolver_env_mode() -> None:
    resolver = build_key_resolver("env")
    assert isinstance(resolver, EnvKeyResolver)


def test_build_key_resolver_vault_mode_not_yet_implemented() -> None:
    # Tripwire — once W13 lands and VaultKeyResolver is implemented this
    # test will fail and force a follow-up to rewrite it. That's deliberate.
    with pytest.raises(NotImplementedError):
        build_key_resolver("vault")


def test_build_key_resolver_rejects_unknown_mode() -> None:
    with pytest.raises(ValueError):
        build_key_resolver("nope")


# Mark the otherwise-unreferenced VaultKeyResolver import so ruff is happy
# even if the test above is removed when the resolver is implemented.
_ = VaultKeyResolver
