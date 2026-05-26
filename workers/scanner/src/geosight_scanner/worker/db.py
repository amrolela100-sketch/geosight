"""asyncpg adapter — typed queries the handler needs.

This module wraps the bare-minimum read/write set for the scan worker:

    fetch_brand               — load brand + aliases + competitors
    fetch_keywords            — load keywords (by ids OR all active for brand)
    insert_scan_result        — append one row to scan_results
    touch_keyword_last_scanned — set keywords.last_scanned_at = now()

Connection assumptions:
    DATABASE_URL points to a service-role / direct connection. The worker is
    a backend service, not a user-facing surface, so it intentionally
    bypasses the RLS path used by apps/api (see packages/db/src/client.ts
    withClerkAuth). Tenant safety is enforced *here* by passing org_id into
    fetch_brand — we refuse to act on a brand that does not belong to the
    org named in the BullMQ payload.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol
from uuid import UUID

import asyncpg

from geosight_scanner.types import ProviderName


@dataclass(frozen=True, slots=True)
class BrandRow:
    id: UUID
    org_id: UUID
    name_ar: str
    name_en: str
    aliases_ar: tuple[str, ...]
    aliases_en: tuple[str, ...]
    competitors: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class KeywordRow:
    id: UUID
    brand_id: UUID
    query_text: str
    language: str  # 'ar' | 'en' — enum mirror
    dialect: str  # 'msa' | 'gulf' | 'levantine' | 'egyptian' | 'auto'
    is_active: bool


@dataclass(frozen=True, slots=True)
class ScanResultInsert:
    keyword_id: UUID
    ai_provider: ProviderName
    raw_response: dict[str, Any]
    geo_score: float
    brand_mentioned: bool
    mention_position: int | None
    mention_rank: int | None
    sentiment: str  # 'positive' | 'neutral' | 'negative'
    sentiment_score: float
    citations: tuple[str, ...]
    competitors_mentioned: tuple[str, ...]
    context_snippet: str | None
    detected_dialect: str | None
    latency_ms: int
    scanned_at: datetime


class ScanRepo(Protocol):
    """Narrow interface the handler depends on — easy to fake in tests."""

    async def fetch_brand(self, brand_id: UUID, org_id: UUID) -> BrandRow | None: ...
    async def fetch_keywords(
        self, brand_id: UUID, keyword_ids: list[UUID] | None
    ) -> list[KeywordRow]: ...
    async def insert_scan_result(self, row: ScanResultInsert) -> UUID: ...
    async def touch_keyword_last_scanned(self, keyword_id: UUID, scanned_at: datetime) -> None: ...
    async def close(self) -> None: ...


class AsyncpgScanRepo:
    """ScanRepo implementation backed by an asyncpg pool."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    @classmethod
    async def connect(cls, database_url: str, *, max_size: int = 4) -> AsyncpgScanRepo:
        # min_size=1 keeps a warm connection so the first job after a quiet
        # period doesn't pay the TLS handshake. max_size bounds parallelism
        # in step with WORKER_CONCURRENCY (worker.main does the matching).
        pool = await asyncpg.create_pool(
            database_url,
            min_size=1,
            max_size=max_size,
            command_timeout=30,
        )
        if pool is None:  # pragma: no cover — defensive, asyncpg never returns None
            raise RuntimeError("asyncpg.create_pool returned None")
        return cls(pool)

    async def fetch_brand(self, brand_id: UUID, org_id: UUID) -> BrandRow | None:
        # Both ids in the WHERE clause: refuses cross-tenant fetch even when
        # the worker connects as a superuser (no RLS to fall back on).
        row = await self._pool.fetchrow(
            """
            SELECT id, org_id, name_ar, name_en, aliases_ar, aliases_en, competitors
              FROM brands
             WHERE id = $1 AND org_id = $2
            """,
            brand_id,
            org_id,
        )
        if row is None:
            return None
        return BrandRow(
            id=row["id"],
            org_id=row["org_id"],
            name_ar=row["name_ar"],
            name_en=row["name_en"],
            aliases_ar=tuple(row["aliases_ar"] or ()),
            aliases_en=tuple(row["aliases_en"] or ()),
            competitors=tuple(row["competitors"] or ()),
        )

    async def fetch_keywords(
        self, brand_id: UUID, keyword_ids: list[UUID] | None
    ) -> list[KeywordRow]:
        # When the payload omits keywordIds, scan ALL active keywords for the
        # brand — matches the documented behaviour of POST /scans/trigger.
        if keyword_ids:
            rows = await self._pool.fetch(
                """
                SELECT id, brand_id, query_text, language, dialect, is_active
                  FROM keywords
                 WHERE brand_id = $1
                   AND id = ANY($2::uuid[])
                   AND is_active = true
                """,
                brand_id,
                keyword_ids,
            )
        else:
            rows = await self._pool.fetch(
                """
                SELECT id, brand_id, query_text, language, dialect, is_active
                  FROM keywords
                 WHERE brand_id = $1 AND is_active = true
                """,
                brand_id,
            )
        return [
            KeywordRow(
                id=r["id"],
                brand_id=r["brand_id"],
                query_text=r["query_text"],
                language=r["language"],
                dialect=r["dialect"],
                is_active=r["is_active"],
            )
            for r in rows
        ]

    async def insert_scan_result(self, row: ScanResultInsert) -> UUID:
        import json

        returned = await self._pool.fetchval(
            """
            INSERT INTO scan_results (
                keyword_id, ai_provider, raw_response, geo_score,
                brand_mentioned, mention_position, mention_rank,
                sentiment, sentiment_score, citations,
                competitors_mentioned, context_snippet,
                detected_dialect, latency_ms, scanned_at
            ) VALUES (
                $1, $2::ai_provider, $3::jsonb, $4,
                $5, $6, $7,
                $8::sentiment, $9, $10::text[],
                $11::text[], $12,
                $13::dialect, $14, $15
            )
            RETURNING id
            """,
            row.keyword_id,
            row.ai_provider.value,
            json.dumps(row.raw_response, ensure_ascii=False, default=str),
            row.geo_score,
            row.brand_mentioned,
            row.mention_position,
            row.mention_rank,
            row.sentiment,
            row.sentiment_score,
            list(row.citations),
            list(row.competitors_mentioned),
            row.context_snippet,
            row.detected_dialect,
            row.latency_ms,
            row.scanned_at,
        )
        return returned  # type: ignore[no-any-return]

    async def touch_keyword_last_scanned(self, keyword_id: UUID, scanned_at: datetime) -> None:
        await self._pool.execute(
            "UPDATE keywords SET last_scanned_at = $2, updated_at = now() WHERE id = $1",
            keyword_id,
            scanned_at,
        )

    async def close(self) -> None:
        await self._pool.close()
