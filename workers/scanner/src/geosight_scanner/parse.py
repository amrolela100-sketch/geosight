"""Heuristic parser — extracts GEO signal from a provider response.

Phase 0 keeps everything heuristic and dependency-light. Phase 2 swaps in the
production multi-strategy detector with a labeled 1000-item Arabic test set
and dialect glossaries (see docs/ROADMAP.md).
"""

from __future__ import annotations

import re
from typing import Final, Literal

from rapidfuzz import fuzz

from geosight_scanner.normalize import normalize, normalize_case_insensitive
from geosight_scanner.types import Brand, Dialect, ParsedResult, ProviderResponse

# ── GEO Score weights ────────────────────────────────────────────────────────
# Mirrors the formula in docs/ROADMAP.md § Phase 2 / Week 12. Configurable in
# the UI from Agency plan onwards.
_WEIGHT_BRAND_MENTION: Final = 0.35
_WEIGHT_MENTION_POSITION: Final = 0.15
_WEIGHT_CITATION_QUALITY: Final = 0.25
_WEIGHT_COMPETITOR_ABSENCE: Final = 0.10
_WEIGHT_SENTIMENT: Final = 0.15

# ── Citation extraction ──────────────────────────────────────────────────────
_URL_RE = re.compile(r"https?://[^\s\)\]\>]+", re.IGNORECASE)

# ── Sentiment lexicons (deliberately tiny — Phase 0 baseline only) ──────────
_POSITIVE_TERMS: Final[tuple[str, ...]] = (
    "افضل",
    "احسن",
    "اروع",
    "ممتاز",
    "متميز",
    "رائد",
    "موثوق",
    "مفضل",
    "اوصي",
    "انصح",
    "جودة عاليه",
)
_NEGATIVE_TERMS: Final[tuple[str, ...]] = (
    "سيء",
    "اسوا",
    "ضعيف",
    "رديء",
    "مخيب",
    "تجنب",
    "لا انصح",
    "مشاكل",
)

# ── Dialect markers (Phase 0 — single strongest signal per dialect) ─────────
_DIALECT_MARKERS: Final[dict[Dialect, tuple[str, ...]]] = {
    "gulf": ("وش", "ايش", "زين", "هواي", "وايد"),
    "levantine": ("شو", "هلق", "كتير", "منيح", "بدي"),
    "egyptian": ("ايه", "عايز", "ازاي", "خالص", "اوي"),
    "msa": ("هل", "ما هي", "اقترح", "اوصي", "ايهما"),
}

# Fuzzy threshold — empirically picked, will be tuned against the labeled
# dataset in Phase 2. 85 = "looks like the same word with a typo or two".
_FUZZY_THRESHOLD: Final = 85


# ─────────────────────────────────────────────────────────────────────────────
# Brand detection — multi-strategy, ordered cheapest → most expensive.
# ─────────────────────────────────────────────────────────────────────────────


def _candidates_for(brand: Brand) -> tuple[str, ...]:
    """All strings the parser should consider when looking for `brand`."""
    return (brand.name_ar, brand.name_en, *brand.aliases)


def detect_brand(normalized_text: str, brand: Brand) -> int | None:
    """Find the earliest character offset where any brand candidate appears.

    Strategies, in order:
      1. exact substring (normalized form, case-sensitive Arabic)
      2. exact substring (case-insensitive — catches English-in-Arabic mixes)
      3. fuzzy token match (catches typos and transliteration variants)

    Returns the 0-indexed char offset of the first hit, or None if no hit.
    """
    if not normalized_text:
        return None

    candidates = [normalize(c) for c in _candidates_for(brand) if c]
    candidates_ci = [normalize_case_insensitive(c) for c in candidates]
    text_ci = normalized_text.lower()

    # Strategy 1 + 2 — exact substring, both case-sensitive and case-insensitive.
    earliest: int | None = None
    for needle in candidates:
        idx = normalized_text.find(needle)
        if idx >= 0 and (earliest is None or idx < earliest):
            earliest = idx
    for needle in candidates_ci:
        idx = text_ci.find(needle)
        if idx >= 0 and (earliest is None or idx < earliest):
            earliest = idx
    if earliest is not None:
        return earliest

    # Strategy 3 — fuzzy over each token. partial_ratio handles "كريم" inside
    # "تطبيق كريم للتوصيل" cleanly.
    tokens = normalized_text.split()
    cursor = 0
    for token in tokens:
        token_start = normalized_text.find(token, cursor)
        cursor = token_start + len(token) if token_start >= 0 else cursor
        for needle in candidates:
            if len(needle) < 3:
                continue
            if fuzz.partial_ratio(token, needle) >= _FUZZY_THRESHOLD:
                return token_start if token_start >= 0 else 0

    return None


def detect_competitors(normalized_text: str, brand: Brand) -> tuple[str, ...]:
    """Return competitors mentioned, in encounter order, deduplicated."""
    found: list[str] = []
    seen: set[str] = set()
    for competitor in brand.competitors:
        competitor_n = normalize(competitor)
        if competitor_n and competitor_n in normalized_text and competitor not in seen:
            found.append(competitor)
            seen.add(competitor)
    return tuple(found)


def mention_rank(
    normalized_text: str,
    target: Brand,
    competitors: tuple[str, ...],
) -> int | None:
    """1-indexed rank of `target` among all brand-like entities mentioned.

    Used by the position component of GEO Score. Returns None if the target
    isn't mentioned at all.
    """
    target_pos = detect_brand(normalized_text, target)
    if target_pos is None:
        return None

    competitor_positions: list[int] = []
    for c in competitors:
        c_norm = normalize(c)
        if not c_norm:
            continue
        idx = normalized_text.find(c_norm)
        if idx >= 0:
            competitor_positions.append(idx)

    ahead = sum(1 for pos in competitor_positions if pos < target_pos)
    return ahead + 1


# ─────────────────────────────────────────────────────────────────────────────
# Citations / sentiment / dialect
# ─────────────────────────────────────────────────────────────────────────────


def extract_citations(response: ProviderResponse) -> tuple[str, ...]:
    """Union of provider-declared citations and URLs found in the text."""
    from_text = tuple(_URL_RE.findall(response.text))
    seen: set[str] = set()
    merged: list[str] = []
    for url in (*response.citations, *from_text):
        normalized_url = url.rstrip(".,;:")
        if normalized_url and normalized_url not in seen:
            merged.append(normalized_url)
            seen.add(normalized_url)
    return tuple(merged)


def analyze_sentiment(
    normalized_text: str, target: Brand
) -> Literal["positive", "neutral", "negative"]:
    """Score sentiment in the ~80 chars surrounding the target mention.

    Pure heuristic, deliberately narrow. Phase 2 replaces with a transformer
    fine-tuned on Arabic dialect sentiment data.
    """
    pos = detect_brand(normalized_text, target)
    if pos is None:
        return "neutral"

    window = normalized_text[max(0, pos - 80) : pos + 80]
    pos_hits = sum(1 for term in _POSITIVE_TERMS if term in window)
    neg_hits = sum(1 for term in _NEGATIVE_TERMS if term in window)

    if pos_hits > neg_hits:
        return "positive"
    if neg_hits > pos_hits:
        return "negative"
    return "neutral"


def detect_dialect(normalized_text: str) -> Dialect | None:
    """Pick the dialect whose markers fire the most. Ties → MSA."""
    scores: dict[Dialect, int] = {dialect: 0 for dialect in _DIALECT_MARKERS}
    for dialect, markers in _DIALECT_MARKERS.items():
        for marker in markers:
            if marker in normalized_text:
                scores[dialect] += 1

    if not any(scores.values()):
        return None

    top = max(scores.items(), key=lambda kv: kv[1])
    return top[0]


def extract_context(normalized_text: str, target: Brand, window: int = 120) -> str | None:
    """Return ±`window` chars around the first mention of the target brand."""
    pos = detect_brand(normalized_text, target)
    if pos is None:
        return None
    start = max(0, pos - window)
    end = min(len(normalized_text), pos + window)
    snippet = normalized_text[start:end].strip()
    return snippet or None


# ─────────────────────────────────────────────────────────────────────────────
# GEO Score
# ─────────────────────────────────────────────────────────────────────────────


def _position_score(rank: int | None, total_brands_in_text: int) -> float:
    """Reward earlier mentions. 1.0 if first, decays to 0.0 if last/missing."""
    if rank is None or total_brands_in_text <= 0:
        return 0.0
    if total_brands_in_text == 1:
        return 1.0
    return max(0.0, 1.0 - (rank - 1) / total_brands_in_text)


def _citation_score(citations: tuple[str, ...]) -> float:
    """0 citations = 0, 1 = 0.5, 2+ = 1.0. Crude but signal-bearing."""
    if not citations:
        return 0.0
    if len(citations) == 1:
        return 0.5
    return 1.0


def _competitor_absence_score(competitors: tuple[str, ...]) -> float:
    """1.0 if no competitors mentioned, decays as more show up."""
    if not competitors:
        return 1.0
    return max(0.0, 1.0 - 0.25 * len(competitors))


def _sentiment_score(sentiment: Literal["positive", "neutral", "negative"]) -> float:
    return {"positive": 1.0, "neutral": 0.5, "negative": 0.0}[sentiment]


def compute_geo_score(
    *,
    brand_mentioned: bool,
    rank: int | None,
    total_brands_in_text: int,
    citations: tuple[str, ...],
    competitors_mentioned: tuple[str, ...],
    sentiment: Literal["positive", "neutral", "negative"],
) -> float:
    """Combine the five signal components into a 0..100 score.

    Weights mirror docs/ROADMAP.md and will be made customer-configurable in
    the dashboard from the Agency plan onward.
    """
    components = (
        (1.0 if brand_mentioned else 0.0) * _WEIGHT_BRAND_MENTION,
        _position_score(rank, total_brands_in_text) * _WEIGHT_MENTION_POSITION,
        _citation_score(citations) * _WEIGHT_CITATION_QUALITY,
        _competitor_absence_score(competitors_mentioned) * _WEIGHT_COMPETITOR_ABSENCE,
        _sentiment_score(sentiment) * _WEIGHT_SENTIMENT,
    )
    return round(sum(components) * 100, 2)


# ─────────────────────────────────────────────────────────────────────────────
# Top-level parse entry point
# ─────────────────────────────────────────────────────────────────────────────


def parse(response: ProviderResponse, brand: Brand) -> ParsedResult:
    """End-to-end parse: provider response + target brand → ParsedResult."""
    normalized = normalize(response.text)
    position = detect_brand(normalized, brand)
    competitors = detect_competitors(normalized, brand)
    rank = mention_rank(normalized, brand, competitors)
    total_brands = (1 if position is not None else 0) + len(competitors)
    citations = extract_citations(response)
    sentiment = analyze_sentiment(normalized, brand)
    dialect = detect_dialect(normalized)
    snippet = extract_context(normalized, brand)

    geo_score = compute_geo_score(
        brand_mentioned=position is not None,
        rank=rank,
        total_brands_in_text=total_brands,
        citations=citations,
        competitors_mentioned=competitors,
        sentiment=sentiment,
    )

    return ParsedResult(
        brand_mentioned=position is not None,
        mention_position=position,
        mention_rank=rank,
        citations=citations,
        competitors_mentioned=competitors,
        sentiment=sentiment,
        geo_score=geo_score,
        detected_dialect=dialect,
        context_snippet=snippet,
    )
