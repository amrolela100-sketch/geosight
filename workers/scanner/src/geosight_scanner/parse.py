"""Heuristic parser — extracts GEO signal from a provider response.

Phase 0 keeps everything heuristic and dependency-light. Phase 2 swaps in the
production multi-strategy detector with a labeled 1000-item Arabic test set
and dialect glossaries (see docs/ROADMAP.md).
"""

from __future__ import annotations

import re
from typing import Final, Literal

from rapidfuzz import fuzz

from geosight_scanner.dialects import detect_dialect
from geosight_scanner.normalize import normalize, normalize_case_insensitive
from geosight_scanner.types import Brand, ParsedResult, ProviderResponse

__all__ = [
    "analyze_sentiment",
    "compute_geo_score",
    "detect_brand",
    "detect_competitors",
    "detect_dialect",
    "extract_citations",
    "extract_context",
    "mention_rank",
    "parse",
]

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

_FUZZY_WORD_THRESHOLD: Final = 86
_FUZZY_PHRASE_THRESHOLD: Final = 90


# ─────────────────────────────────────────────────────────────────────────────
# Brand detection — multi-strategy, ordered cheapest → most expensive.
# ─────────────────────────────────────────────────────────────────────────────


def _candidates_for(brand: Brand) -> tuple[str, ...]:
    """All strings the parser should consider when looking for `brand`."""
    return (brand.name_ar, brand.name_en, *brand.aliases)


def _dedupe(values: tuple[str, ...] | list[str]) -> tuple[str, ...]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        cleaned = value.strip()
        key = normalize_case_insensitive(cleaned)
        if cleaned and key not in seen:
            deduped.append(cleaned)
            seen.add(key)
    return tuple(deduped)


def _latin_to_arabic_variants(value: str) -> tuple[str, ...]:
    """Small rule-based transliteration aid for common brand candidates.

    This is deliberately conservative: it augments brand aliases; it is not a
    general transliteration engine.
    """
    raw = value.strip().casefold()
    if not raw or not re.fullmatch(r"[a-z0-9 &.+-]+", raw):
        return ()

    compact = re.sub(r"[^a-z0-9]+", "", raw)
    known: dict[str, tuple[str, ...]] = {
        "saudia": ("السعوديه", "سعوديه"),
        "saudiaairlines": ("الخطوط السعوديه", "السعوديه"),
        "careem": ("كريم", "كرييم"),
        "samsung": ("سامسونج", "سامسونغ", "سامسونق"),
        "emirates": ("طيران الامارات", "الامارات"),
        "qatarairways": ("القطريه", "الخطوط القطريه"),
        "uber": ("اوبر",),
    }
    if compact in known:
        return known[compact]

    table = (
        ("sh", "ش"),
        ("kh", "خ"),
        ("gh", "غ"),
        ("th", "ث"),
        ("dh", "ذ"),
        ("aa", "ا"),
        ("ee", "ي"),
        ("oo", "و"),
        ("a", "ا"),
        ("b", "ب"),
        ("c", "ك"),
        ("d", "د"),
        ("e", "ي"),
        ("f", "ف"),
        ("g", "ج"),
        ("h", "ه"),
        ("i", "ي"),
        ("j", "ج"),
        ("k", "ك"),
        ("l", "ل"),
        ("m", "م"),
        ("n", "ن"),
        ("o", "و"),
        ("p", "ب"),
        ("q", "ق"),
        ("r", "ر"),
        ("s", "س"),
        ("t", "ت"),
        ("u", "و"),
        ("v", "ف"),
        ("w", "و"),
        ("x", "كس"),
        ("y", "ي"),
        ("z", "ز"),
    )
    out = compact
    for latin, arabic in table:
        out = out.replace(latin, arabic)
    return (out,) if out and out != compact else ()


def _normalized_candidates_for(brand: Brand) -> tuple[str, ...]:
    base = _dedupe(tuple(c for c in _candidates_for(brand) if c))
    variants: list[str] = []
    for candidate in base:
        variants.append(candidate)
        variants.extend(_latin_to_arabic_variants(candidate))
    return _dedupe([normalize(candidate) for candidate in variants])


def _normalized_literal_candidates_for(brand: Brand) -> tuple[str, ...]:
    return _dedupe([normalize(candidate) for candidate in _candidates_for(brand) if candidate])


def _find_exact(normalized_text: str, candidates: tuple[str, ...]) -> int | None:
    earliest: int | None = None
    for needle in candidates:
        idx = normalized_text.find(needle)
        if idx >= 0 and (earliest is None or idx < earliest):
            earliest = idx
    return earliest


def _find_exact_casefold(normalized_text: str, candidates: tuple[str, ...]) -> int | None:
    text_ci = normalized_text.casefold()
    earliest: int | None = None
    for needle in candidates:
        idx = text_ci.find(normalize_case_insensitive(needle))
        if idx >= 0 and (earliest is None or idx < earliest):
            earliest = idx
    return earliest


def _find_fuzzy(normalized_text: str, candidates: tuple[str, ...]) -> int | None:
    tokens = normalized_text.split()
    if not tokens:
        return None

    spans: list[tuple[str, int]] = []
    cursor = 0
    for token in tokens:
        token_start = normalized_text.find(token, cursor)
        if token_start < 0:
            continue
        spans.append((token, token_start))
        cursor = token_start + len(token)

    earliest: int | None = None
    for candidate in candidates:
        candidate_tokens = candidate.split()
        if len(candidate) < 3:
            continue
        window_size = max(1, len(candidate_tokens))
        for idx in range(0, len(spans)):
            window = " ".join(token for token, _ in spans[idx : idx + window_size])
            if not window:
                continue
            threshold = _FUZZY_PHRASE_THRESHOLD if window_size > 1 else _FUZZY_WORD_THRESHOLD
            score = fuzz.ratio(window, candidate)
            if score < threshold and window_size == 1:
                score = fuzz.partial_ratio(window, candidate)
            if score >= threshold:
                token_start = spans[idx][1]
                if earliest is None or token_start < earliest:
                    earliest = token_start
    return earliest


def detect_brand(normalized_text: str, brand: Brand) -> int | None:
    """Find the earliest character offset where any brand candidate appears.

    Strategies, in order:
      1. exact substring (normalized form, case-sensitive Arabic)
      2. exact substring (case-insensitive — catches English-in-Arabic mixes)
      3. transliteration-assisted candidates from English aliases
      4. fuzzy token/phrase match (catches typos)

    Returns the 0-indexed char offset of the first hit, or None if no hit.
    """
    if not normalized_text:
        return None

    candidates = _normalized_candidates_for(brand)

    for strategy in (_find_exact, _find_exact_casefold, _find_fuzzy):
        hit = strategy(normalized_text, candidates)
        if hit is not None:
            return hit
    return None


def detect_competitors(normalized_text: str, brand: Brand) -> tuple[str, ...]:
    """Return competitors mentioned, in encounter order, deduplicated."""
    hits: list[tuple[int, str]] = []
    for competitor in brand.competitors:
        candidates = _normalized_literal_candidates_for(
            Brand(name_ar=competitor, name_en=competitor)
        )
        idx = _find_exact(normalized_text, candidates)
        if idx is None:
            idx = _find_exact_casefold(normalized_text, candidates)
        if idx is not None:
            hits.append((idx, competitor))

    found: list[str] = []
    seen: set[str] = set()
    for _, competitor in sorted(hits, key=lambda hit: hit[0]):
        key = normalize_case_insensitive(competitor)
        if key not in seen:
            found.append(competitor)
            seen.add(key)
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
        candidates = _normalized_literal_candidates_for(Brand(name_ar=c, name_en=c))
        idx = _find_exact(normalized_text, candidates)
        if idx is None:
            idx = _find_exact_casefold(normalized_text, candidates)
        if idx is not None:
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
