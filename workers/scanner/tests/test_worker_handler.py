"""Worker handler tests — payload parsing + scan job lifecycle.

Tests use a fake ScanRepo and a fake provider client so the handler is
exercised end-to-end without Redis, Postgres, or real API keys.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest

from geosight_scanner.providers.base import ProviderClient, ProviderError
from geosight_scanner.types import ProviderName, ProviderResponse
from geosight_scanner.worker.db import BrandRow, KeywordRow, ScanResultInsert
from geosight_scanner.worker.handler import (
    HandlerDeps,
    HandlerError,
    ScanJobPayload,
    UnrecoverableHandlerError,
    parse_payload,
    process_scan_job,
)
from geosight_scanner.worker.keys import EnvKeyResolver, KeyResolutionError

# ─────────────────────────────────────────────────────────────────────────────
# Test doubles
# ─────────────────────────────────────────────────────────────────────────────


class FakeRepo:
    """In-memory ScanRepo capturing inserts so tests can assert on them."""

    def __init__(
        self,
        *,
        brand: BrandRow | None = None,
        keywords: list[KeywordRow] | None = None,
    ) -> None:
        self._brand = brand
        self._keywords = keywords or []
        self.inserted: list[ScanResultInsert] = []
        self.touched: list[UUID] = []

    async def fetch_brand(self, brand_id: UUID, org_id: UUID) -> BrandRow | None:
        if (
            self._brand is None
            or self._brand.id != brand_id
            or self._brand.org_id != org_id
        ):
            return None
        return self._brand

    async def fetch_keywords(
        self, brand_id: UUID, keyword_ids: list[UUID] | None
    ) -> list[KeywordRow]:
        rows = [k for k in self._keywords if k.brand_id == brand_id]
        if keyword_ids:
            wanted = set(keyword_ids)
            rows = [k for k in rows if k.id in wanted]
        return rows

    async def insert_scan_result(self, row: ScanResultInsert) -> UUID:
        self.inserted.append(row)
        return uuid4()

    async def touch_keyword_last_scanned(self, keyword_id: UUID, scanned_at: datetime) -> None:
        self.touched.append(keyword_id)

    async def close(self) -> None:
        return None


class FakeProvider(ProviderClient):
    """Deterministic provider — returns canned text mentioning the brand."""

    def __init__(
        self,
        name: ProviderName,
        *,
        text: str = "نوصي بـ سامسونج للأجهزة المنزلية.",
        fail: bool = False,
    ) -> None:
        super().__init__(api_key="test-key")
        self.name = name
        self._text = text
        self._fail = fail
        self.calls = 0

    async def query(self, prompt: str) -> ProviderResponse:
        self.calls += 1
        if self._fail:
            raise ProviderError(self.name, "synthetic failure", status=429)
        return ProviderResponse(
            provider=self.name,
            text=self._text,
            citations=("https://example.com",),
            latency_ms=42,
            fetched_at=datetime.now(UTC),
            raw={"prompt": prompt},
        )


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


ORG_ID = UUID("11111111-1111-1111-1111-111111111111")
BRAND_ID = UUID("22222222-2222-2222-2222-222222222222")
KEYWORD_ID = UUID("33333333-3333-3333-3333-333333333333")


def _brand_row() -> BrandRow:
    return BrandRow(
        id=BRAND_ID,
        org_id=ORG_ID,
        name_ar="سامسونج",
        name_en="Samsung",
        aliases_ar=("سامسونغ",),
        aliases_en=("samsung electronics",),
        competitors=("LG", "Sony"),
    )


def _keyword_row(id_: UUID = KEYWORD_ID) -> KeywordRow:
    return KeywordRow(
        id=id_,
        brand_id=BRAND_ID,
        query_text="ما أفضل علامة تلفزيونات؟",
        language="ar",
        dialect="msa",
        is_active=True,
    )


def _payload(keyword_ids: list[UUID] | None = None) -> ScanJobPayload:
    return ScanJobPayload(
        organization_id=ORG_ID,
        brand_id=BRAND_ID,
        keyword_ids=keyword_ids,
        requested_by_user_id="user_clerk_abc",
        requested_at=datetime.now(UTC),
    )


def _factory_with(providers: dict[ProviderName, FakeProvider]) -> Any:
    def factory(name: ProviderName, api_key: str) -> ProviderClient:
        return providers[name]

    return factory


# ─────────────────────────────────────────────────────────────────────────────
# parse_payload
# ─────────────────────────────────────────────────────────────────────────────


def test_parse_payload_accepts_minimal_zod_shape() -> None:
    raw = {
        "organizationId": str(ORG_ID),
        "brandId": str(BRAND_ID),
        "requestedAt": "2026-05-26T10:00:00.000Z",
    }
    parsed = parse_payload(raw)
    assert parsed.organization_id == ORG_ID
    assert parsed.brand_id == BRAND_ID
    assert parsed.keyword_ids is None
    assert parsed.requested_at.tzinfo is not None


def test_parse_payload_treats_empty_keyword_list_as_none() -> None:
    # Zod's .min(1) blocks the empty array at the API edge; if a stale enqueue
    # slips through anyway, fall back to "scan all keywords" rather than 400.
    raw = {
        "organizationId": str(ORG_ID),
        "brandId": str(BRAND_ID),
        "keywordIds": [],
        "requestedAt": "2026-05-26T10:00:00+00:00",
    }
    assert parse_payload(raw).keyword_ids is None


def test_parse_payload_rejects_bad_uuid() -> None:
    raw = {
        "organizationId": "not-a-uuid",
        "brandId": str(BRAND_ID),
        "requestedAt": "2026-05-26T10:00:00Z",
    }
    with pytest.raises(UnrecoverableHandlerError):
        parse_payload(raw)


def test_parse_payload_rejects_bad_datetime() -> None:
    raw = {
        "organizationId": str(ORG_ID),
        "brandId": str(BRAND_ID),
        "requestedAt": "yesterday",
    }
    with pytest.raises(UnrecoverableHandlerError):
        parse_payload(raw)


def test_parse_payload_rejects_non_dict() -> None:
    with pytest.raises(UnrecoverableHandlerError):
        parse_payload("not-a-dict")  # type: ignore[arg-type]


# ─────────────────────────────────────────────────────────────────────────────
# process_scan_job
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_process_scan_job_writes_one_row_per_provider_per_keyword() -> None:
    repo = FakeRepo(brand=_brand_row(), keywords=[_keyword_row()])
    providers = {
        ProviderName.OPENAI: FakeProvider(ProviderName.OPENAI),
        ProviderName.GEMINI: FakeProvider(ProviderName.GEMINI),
        ProviderName.PERPLEXITY: FakeProvider(ProviderName.PERPLEXITY),
    }
    deps = HandlerDeps(
        repo=repo,
        keys=EnvKeyResolver({
            "OPENAI_API_KEY": "k",
            "GEMINI_API_KEY": "k",
            "PERPLEXITY_API_KEY": "k",
        }),
        provider_factory=_factory_with(providers),
    )

    result = await process_scan_job(_payload(), deps)

    assert result.keyword_count == 1
    assert result.provider_count == 3
    assert result.rows_written == 3
    assert result.rows_failed == 0
    assert result.skipped_providers == ()
    assert len(repo.inserted) == 3
    assert {row.ai_provider for row in repo.inserted} == set(providers.keys())
    # last_scanned_at should be touched once per keyword (not per provider).
    assert repo.touched == [KEYWORD_ID]


@pytest.mark.asyncio
async def test_process_scan_job_raises_unrecoverable_when_brand_missing() -> None:
    repo = FakeRepo(brand=None)
    deps = HandlerDeps(
        repo=repo,
        keys=EnvKeyResolver({"OPENAI_API_KEY": "k"}),
        provider_factory=_factory_with({
            ProviderName.OPENAI: FakeProvider(ProviderName.OPENAI),
        }),
        providers=(ProviderName.OPENAI,),
    )
    with pytest.raises(UnrecoverableHandlerError):
        await process_scan_job(_payload(), deps)


@pytest.mark.asyncio
async def test_process_scan_job_returns_zero_when_no_active_keywords() -> None:
    repo = FakeRepo(brand=_brand_row(), keywords=[])
    deps = HandlerDeps(
        repo=repo,
        keys=EnvKeyResolver({"OPENAI_API_KEY": "k"}),
        provider_factory=_factory_with({
            ProviderName.OPENAI: FakeProvider(ProviderName.OPENAI),
        }),
        providers=(ProviderName.OPENAI,),
    )
    result = await process_scan_job(_payload(), deps)
    assert result.rows_written == 0
    assert result.keyword_count == 0
    assert repo.inserted == []


@pytest.mark.asyncio
async def test_process_scan_job_raises_recoverable_when_all_keys_missing() -> None:
    repo = FakeRepo(brand=_brand_row(), keywords=[_keyword_row()])
    deps = HandlerDeps(
        repo=repo,
        keys=EnvKeyResolver({}),  # no keys at all
        provider_factory=_factory_with({}),
        providers=(ProviderName.OPENAI,),
    )
    with pytest.raises(HandlerError) as excinfo:
        await process_scan_job(_payload(), deps)
    # Recoverable: not the Unrecoverable subclass — so BullMQ will retry.
    assert not isinstance(excinfo.value, UnrecoverableHandlerError)


@pytest.mark.asyncio
async def test_process_scan_job_counts_provider_failure_without_aborting() -> None:
    repo = FakeRepo(brand=_brand_row(), keywords=[_keyword_row()])
    providers = {
        ProviderName.OPENAI: FakeProvider(ProviderName.OPENAI, fail=True),
        ProviderName.GEMINI: FakeProvider(ProviderName.GEMINI),
    }
    deps = HandlerDeps(
        repo=repo,
        keys=EnvKeyResolver({
            "OPENAI_API_KEY": "k",
            "GEMINI_API_KEY": "k",
        }),
        provider_factory=_factory_with(providers),
        providers=(ProviderName.OPENAI, ProviderName.GEMINI),
    )
    result = await process_scan_job(_payload(), deps)
    assert result.rows_written == 1
    assert result.rows_failed == 1
    assert {row.ai_provider for row in repo.inserted} == {ProviderName.GEMINI}


@pytest.mark.asyncio
async def test_process_scan_job_skips_provider_with_missing_key() -> None:
    repo = FakeRepo(brand=_brand_row(), keywords=[_keyword_row()])
    providers = {
        ProviderName.OPENAI: FakeProvider(ProviderName.OPENAI),
    }
    deps = HandlerDeps(
        repo=repo,
        keys=EnvKeyResolver({"OPENAI_API_KEY": "k"}),  # gemini missing
        provider_factory=_factory_with(providers),
        providers=(ProviderName.OPENAI, ProviderName.GEMINI),
    )
    result = await process_scan_job(_payload(), deps)
    assert result.provider_count == 1
    assert result.rows_written == 1
    assert result.skipped_providers == (ProviderName.GEMINI,)


# ─────────────────────────────────────────────────────────────────────────────
# EnvKeyResolver
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_env_key_resolver_returns_key_when_set() -> None:
    resolver = EnvKeyResolver({"OPENAI_API_KEY": "sk-test"})
    key = await resolver.resolve("org-1", ProviderName.OPENAI)
    assert key == "sk-test"


@pytest.mark.asyncio
async def test_env_key_resolver_raises_when_missing() -> None:
    resolver = EnvKeyResolver({})
    with pytest.raises(KeyResolutionError):
        await resolver.resolve("org-1", ProviderName.OPENAI)
