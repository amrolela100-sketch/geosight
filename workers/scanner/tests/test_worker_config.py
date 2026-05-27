"""Worker config + key-resolver wiring tests."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from geosight_scanner.worker.config import ConfigError, VaultClientConfig, load_config
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
    assert config.response_cache_ttl_seconds == 86_400


def test_load_config_response_cache_ttl_disabled_with_zero() -> None:
    with patch.dict(
        os.environ,
        {
            "DATABASE_URL": "postgres://x",
            "REDIS_URL": "redis://x",
            "RESPONSE_CACHE_TTL": "0",
        },
        clear=True,
    ):
        config = load_config()
    assert config.response_cache_ttl_seconds == 0


def test_load_config_response_cache_ttl_custom_value() -> None:
    with patch.dict(
        os.environ,
        {
            "DATABASE_URL": "postgres://x",
            "REDIS_URL": "redis://x",
            "RESPONSE_CACHE_TTL": "3600",
        },
        clear=True,
    ):
        config = load_config()
    assert config.response_cache_ttl_seconds == 3600


def test_load_config_rejects_negative_response_cache_ttl() -> None:
    with patch.dict(
        os.environ,
        {
            "DATABASE_URL": "postgres://x",
            "REDIS_URL": "redis://x",
            "RESPONSE_CACHE_TTL": "-1",
        },
        clear=True,
    ):
        with pytest.raises(ConfigError, match="non-negative"):
            load_config()


def test_load_config_rejects_non_integer_response_cache_ttl() -> None:
    with patch.dict(
        os.environ,
        {
            "DATABASE_URL": "postgres://x",
            "REDIS_URL": "redis://x",
            "RESPONSE_CACHE_TTL": "ten-minutes",
        },
        clear=True,
    ):
        with pytest.raises(ConfigError, match="integer"):
            load_config()


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


def test_build_key_resolver_vault_mode_requires_config() -> None:
    # Vault mode without a populated VaultClientConfig is a programmer
    # error — load_config() should always have set it when byok_mode=vault.
    with pytest.raises(ValueError, match="VaultClientConfig"):
        build_key_resolver("vault")


def test_build_key_resolver_vault_mode_with_config() -> None:
    config = VaultClientConfig(
        api_base_url="https://api.test",
        internal_token="token-abc",
        cache_ttl_seconds=300,
    )
    resolver = build_key_resolver("vault", vault_config=config)
    assert isinstance(resolver, VaultKeyResolver)


def test_load_config_vault_mode_requires_api_url_and_token() -> None:
    with patch.dict(
        os.environ,
        {
            "DATABASE_URL": "postgres://x",
            "REDIS_URL": "redis://x",
            "BYOK_MODE": "vault",
        },
        clear=True,
    ):
        with pytest.raises(ConfigError, match="GEOSIGHT_API_URL"):
            load_config()

    with patch.dict(
        os.environ,
        {
            "DATABASE_URL": "postgres://x",
            "REDIS_URL": "redis://x",
            "BYOK_MODE": "vault",
            "GEOSIGHT_API_URL": "https://api.test",
        },
        clear=True,
    ):
        with pytest.raises(ConfigError, match="INTERNAL_SERVICE_TOKEN"):
            load_config()


def test_load_config_vault_mode_happy_path() -> None:
    with patch.dict(
        os.environ,
        {
            "DATABASE_URL": "postgres://x",
            "REDIS_URL": "redis://x",
            "BYOK_MODE": "vault",
            "GEOSIGHT_API_URL": "https://api.test/",
            "INTERNAL_SERVICE_TOKEN": "shared-secret-1234567890",
            "VAULT_KEY_CACHE_TTL": "900",
        },
        clear=True,
    ):
        config = load_config()
    assert config.byok_mode == "vault"
    assert config.vault is not None
    assert config.vault.api_base_url == "https://api.test"
    assert config.vault.internal_token == "shared-secret-1234567890"
    assert config.vault.cache_ttl_seconds == 900


def test_build_key_resolver_rejects_unknown_mode() -> None:
    with pytest.raises(ValueError):
        build_key_resolver("nope")


# Mark the otherwise-unreferenced VaultKeyResolver import so ruff is happy
# even if the test above is removed when the resolver is implemented.
_ = VaultKeyResolver
