"""Pure-async scan job handler — DI-friendly, BullMQ-agnostic.

Lifecycle (per BullMQ job):
    1. Parse + validate the payload  (raises HandlerError on bad input)
    2. Load brand + keywords          (raises if cross-tenant or missing)
    3. For each (provider, keyword):  build Probe → call provider client →
       parse response → insert scan_results row → update last_scanned_at
    4. Return a small summary the caller can stuff into job.returnvalue

Design notes:
    * Provider clients are built lazily per provider per job from a factory
      so a key resolution failure for one provider doesn't poison the others.
    * Per-keyword errors are logged and counted, NOT raised — partial
      results beat no results (same rationale as runner._safe_query).
    * The handler raises only on UNRECOVERABLE input errors (bad payload,
      cross-tenant access, missing brand). BullMQ retries the job on raise.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog

from geosight_scanner.parse import parse
from geosight_scanner.providers.base import ProviderClient, ProviderError
from geosight_scanner.types import Brand, Dialect, Probe, ProviderName

from .db import KeywordRow, ScanRepo, ScanResultInsert
from .keys import KeyResolutionError, KeyResolver

logger = structlog.get_logger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Payload validation — mirrors apps/api/src/queues/payloads.ts (scanJobSchema)
# ─────────────────────────────────────────────────────────────────────────────


class HandlerError(Exception):
    """Raised when the job payload or DB state makes the job unrunnable.

    BullMQ retries when the processor raises. Use this for cases where
    retrying CAN help (transient DB outage). For genuinely unrecoverable
    cases (bad UUID, cross-tenant brand) raise UnrecoverableError so the
    job moves to failed without burning the retry budget.
    """


class UnrecoverableHandlerError(HandlerError):
    """Bad payload / cross-tenant access — retries will not fix this."""


@dataclass(frozen=True, slots=True)
class ScanJobPayload:
    organization_id: UUID
    brand_id: UUID
    keyword_ids: list[UUID] | None
    requested_by_user_id: str | None
    requested_at: datetime


def parse_payload(raw: Any) -> ScanJobPayload:
    """Validate the BullMQ job.data shape from scanJobSchema (Zod)."""
    if not isinstance(raw, dict):
        raise UnrecoverableHandlerError(f"payload must be an object, got {type(raw).__name__}")

    def _uuid(value: Any, field: str) -> UUID:
        if not isinstance(value, str):
            raise UnrecoverableHandlerError(f"{field} must be a uuid string")
        try:
            return UUID(value)
        except ValueError as err:
            raise UnrecoverableHandlerError(f"{field} is not a valid uuid: {value!r}") from err

    organization_id = _uuid(raw.get("organizationId"), "organizationId")
    brand_id = _uuid(raw.get("brandId"), "brandId")

    keyword_ids_raw = raw.get("keywordIds")
    keyword_ids: list[UUID] | None
    if keyword_ids_raw is None:
        keyword_ids = None
    elif isinstance(keyword_ids_raw, list) and keyword_ids_raw:
        keyword_ids = [_uuid(v, "keywordIds[]") for v in keyword_ids_raw]
    elif isinstance(keyword_ids_raw, list):
        # Empty list is explicitly disallowed by Zod (.min(1)); treat as None
        # rather than failing — the user can re-trigger by omitting the field.
        keyword_ids = None
    else:
        raise UnrecoverableHandlerError("keywordIds must be an array of uuids")

    requested_by = raw.get("requestedByUserId")
    if requested_by is not None and not isinstance(requested_by, str):
        raise UnrecoverableHandlerError("requestedByUserId must be a string when present")

    requested_at_raw = raw.get("requestedAt")
    if not isinstance(requested_at_raw, str):
        raise UnrecoverableHandlerError("requestedAt must be an ISO datetime string")
    try:
        # BullMQ serialises Date → string; Zod's .datetime() guarantees
        # offsets present. fromisoformat handles both "Z" (3.11+) and offsets.
        requested_at = datetime.fromisoformat(requested_at_raw.replace("Z", "+00:00"))
    except ValueError as err:
        raise UnrecoverableHandlerError(f"requestedAt not parseable: {requested_at_raw!r}") from err

    return ScanJobPayload(
        organization_id=organization_id,
        brand_id=brand_id,
        keyword_ids=keyword_ids,
        requested_by_user_id=requested_by,
        requested_at=requested_at,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Dependency bag — keeps the handler signature small and tests trivial
# ─────────────────────────────────────────────────────────────────────────────


ProviderFactory = Callable[[ProviderName, str], ProviderClient]
"""Construct a provider client from (name, api_key). Allows tests to inject
fake providers without monkey-patching the real ones."""


@dataclass(frozen=True, slots=True)
class HandlerDeps:
    repo: ScanRepo
    keys: KeyResolver
    provider_factory: ProviderFactory
    providers: tuple[ProviderName, ...] = (
        ProviderName.OPENAI,
        ProviderName.GEMINI,
        ProviderName.PERPLEXITY,
    )


@dataclass(frozen=True, slots=True)
class HandlerResult:
    """What the worker returns to BullMQ (becomes job.returnvalue)."""

    keyword_count: int
    provider_count: int
    rows_written: int
    rows_failed: int
    skipped_providers: tuple[ProviderName, ...]


# ─────────────────────────────────────────────────────────────────────────────
# Core handler
# ─────────────────────────────────────────────────────────────────────────────


def _row_brand_to_runner_brand(
    name_ar: str,
    name_en: str,
    aliases_ar: Sequence[str],
    aliases_en: Sequence[str],
    competitors: Sequence[str],
) -> Brand:
    """DB row → runner.Brand. Merges aliases_ar + aliases_en into one tuple
    because the parser doesn't distinguish AR/EN aliases internally."""
    return Brand(
        name_ar=name_ar,
        name_en=name_en,
        aliases=tuple(aliases_ar) + tuple(aliases_en),
        competitors=tuple(competitors),
    )


_VALID_DIALECTS: frozenset[str] = frozenset({"msa", "gulf", "levantine", "egyptian"})


def _keyword_to_probe(keyword: KeywordRow, brand: Brand) -> Probe:
    # Keywords.dialect can be 'auto' (the default) — pass MSA to the probe so
    # downstream code (which expects a concrete Dialect Literal) has a real
    # value. The parser still detects dialect from the RESPONSE text.
    raw_dialect = keyword.dialect if keyword.dialect in _VALID_DIALECTS else "msa"
    return Probe(
        id=str(keyword.id),
        dialect=raw_dialect,  # type: ignore[arg-type]
        query=keyword.query_text,
        target_brand=brand,
    )


async def _build_clients(
    org_id: UUID,
    providers: Sequence[ProviderName],
    deps: HandlerDeps,
) -> tuple[dict[ProviderName, ProviderClient], tuple[ProviderName, ...]]:
    """Resolve one client per provider; skip those whose keys are missing."""
    clients: dict[ProviderName, ProviderClient] = {}
    skipped: list[ProviderName] = []
    for provider in providers:
        try:
            api_key = await deps.keys.resolve(str(org_id), provider)
        except KeyResolutionError as err:
            logger.warning(
                "scan.provider.skipped",
                provider=provider,
                org_id=str(org_id),
                reason=err.reason,
            )
            skipped.append(provider)
            continue
        clients[provider] = deps.provider_factory(provider, api_key)
    return clients, tuple(skipped)


async def process_scan_job(payload: ScanJobPayload, deps: HandlerDeps) -> HandlerResult:
    """Run one scan job end-to-end. See module docstring for lifecycle."""
    log = logger.bind(
        org_id=str(payload.organization_id),
        brand_id=str(payload.brand_id),
        keyword_ids=[str(k) for k in (payload.keyword_ids or [])],
    )

    brand_row = await deps.repo.fetch_brand(payload.brand_id, payload.organization_id)
    if brand_row is None:
        # Could be: brand deleted, brand belongs to another org, bad UUID.
        # All unrecoverable — no point retrying.
        raise UnrecoverableHandlerError(
            f"brand {payload.brand_id} not found under org {payload.organization_id}"
        )

    keywords = await deps.repo.fetch_keywords(payload.brand_id, payload.keyword_ids)
    if not keywords:
        log.info("scan.skipped", reason="no_active_keywords")
        return HandlerResult(0, 0, 0, 0, ())

    brand = _row_brand_to_runner_brand(
        name_ar=brand_row.name_ar,
        name_en=brand_row.name_en,
        aliases_ar=brand_row.aliases_ar,
        aliases_en=brand_row.aliases_en,
        competitors=brand_row.competitors,
    )

    clients, skipped = await _build_clients(payload.organization_id, deps.providers, deps)
    if not clients:
        # Every provider missing a key — surface as recoverable so the dev
        # can fix env / vault and BullMQ retries.
        raise HandlerError(
            "no provider keys resolved — refusing to mark the job as completed"
        )

    rows_written = 0
    rows_failed = 0

    for keyword in keywords:
        probe = _keyword_to_probe(keyword, brand)
        for provider_name, client in clients.items():
            try:
                response = await client.query(probe.query)
            except ProviderError as err:
                rows_failed += 1
                log.warning(
                    "scan.provider.error",
                    provider=provider_name,
                    keyword_id=str(keyword.id),
                    error=str(err),
                    status=err.status,
                )
                continue
            except Exception as err:
                rows_failed += 1
                log.error(
                    "scan.provider.unexpected",
                    provider=provider_name,
                    keyword_id=str(keyword.id),
                    error=repr(err),
                )
                continue

            parsed = parse(response, brand)
            scanned_at = response.fetched_at if response.fetched_at else datetime.now(UTC)

            row = ScanResultInsert(
                keyword_id=keyword.id,
                ai_provider=provider_name,
                raw_response={
                    "text": response.text,
                    "citations": list(response.citations),
                    "raw": response.raw,
                },
                geo_score=parsed.geo_score,
                brand_mentioned=parsed.brand_mentioned,
                mention_position=parsed.mention_position,
                mention_rank=parsed.mention_rank,
                sentiment=parsed.sentiment,
                sentiment_score=_sentiment_to_score(parsed.sentiment),
                citations=parsed.citations,
                competitors_mentioned=parsed.competitors_mentioned,
                context_snippet=parsed.context_snippet,
                detected_dialect=_dialect_to_enum(parsed.detected_dialect),
                latency_ms=response.latency_ms,
                scanned_at=scanned_at,
            )
            try:
                await deps.repo.insert_scan_result(row)
                rows_written += 1
            except Exception as err:
                rows_failed += 1
                log.error(
                    "scan.persist.error",
                    provider=provider_name,
                    keyword_id=str(keyword.id),
                    error=repr(err),
                )
                continue

        if rows_written:
            # Best-effort — failure here doesn't invalidate the scan rows.
            try:
                await deps.repo.touch_keyword_last_scanned(keyword.id, datetime.now(UTC))
            except Exception as err:
                log.warning(
                    "scan.touch_last_scanned.error",
                    keyword_id=str(keyword.id),
                    error=repr(err),
                )

    log.info(
        "scan.completed",
        keyword_count=len(keywords),
        provider_count=len(clients),
        rows_written=rows_written,
        rows_failed=rows_failed,
        skipped_providers=[p.value for p in skipped],
    )

    return HandlerResult(
        keyword_count=len(keywords),
        provider_count=len(clients),
        rows_written=rows_written,
        rows_failed=rows_failed,
        skipped_providers=skipped,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Small helpers — kept here, not in parse.py, because they translate the
# heuristic parser's Python types into the DB enum strings.
# ─────────────────────────────────────────────────────────────────────────────


def _sentiment_to_score(sentiment: str) -> float:
    """Coarse mapping until the transformer-based score lands in Week 12."""
    return {"positive": 0.6, "neutral": 0.0, "negative": -0.6}.get(sentiment, 0.0)


def _dialect_to_enum(dialect: Dialect | None) -> str | None:
    # Dialect Literal happens to match the DB enum 1:1; this exists so the
    # mapping is named and easy to revisit if the enum diverges.
    return dialect
