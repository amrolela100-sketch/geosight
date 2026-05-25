"""Core data types for the Phase 0 spike.

Frozen dataclasses are used over pydantic to keep the spike dependency-light.
The shape here is the contract that Phase 2 will replace with Drizzle-backed
persistence and Zod-mirrored schemas in @geosight/shared.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Literal


class ProviderName(StrEnum):
    OPENAI = "openai"
    GEMINI = "gemini"
    PERPLEXITY = "perplexity"


Dialect = Literal["msa", "gulf", "levantine", "egyptian"]


@dataclass(frozen=True, slots=True)
class Brand:
    """A brand the scanner is tracking.

    Aliases cover transliterations and common misspellings — the parser tries
    each one in turn (see geosight_scanner.parse.detect_brand).
    """

    name_ar: str
    name_en: str
    aliases: tuple[str, ...] = ()
    competitors: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class Probe:
    """An Arabic query targeted at a specific dialect."""

    id: str
    dialect: Dialect
    query: str
    target_brand: Brand


@dataclass(frozen=True, slots=True)
class ProviderResponse:
    """Raw provider output, before any parsing."""

    provider: ProviderName
    text: str
    citations: tuple[str, ...]
    latency_ms: int
    fetched_at: datetime
    # The raw upstream payload, kept for debugging and re-parsing.
    raw: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ParsedResult:
    """What the heuristic parser extracts from a single provider response."""

    brand_mentioned: bool
    mention_position: int | None  # 0-indexed character offset of first match
    mention_rank: int | None  # 1 if first brand mentioned, 2 if second, etc.
    citations: tuple[str, ...]
    competitors_mentioned: tuple[str, ...]
    sentiment: Literal["positive", "neutral", "negative"]
    geo_score: float  # 0..100
    detected_dialect: Dialect | None
    context_snippet: str | None


@dataclass(frozen=True, slots=True)
class ProbeOutcome:
    """One probe × one provider — the end-to-end result the spike reports on."""

    probe: Probe
    provider: ProviderName
    response: ProviderResponse
    parsed: ParsedResult
