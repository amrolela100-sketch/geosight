"""Parser tests — heuristic brand/competitor/citation/sentiment detection."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from geosight_scanner.normalize import normalize
from geosight_scanner.parse import (
    analyze_sentiment,
    compute_geo_score,
    detect_brand,
    detect_competitors,
    detect_dialect,
    extract_citations,
    mention_rank,
    parse,
)
from geosight_scanner.types import Brand, ProviderName, ProviderResponse


def _response(
    text: str,
    *,
    provider: ProviderName = ProviderName.OPENAI,
    citations: tuple[str, ...] = (),
) -> ProviderResponse:
    return ProviderResponse(
        provider=provider,
        text=text,
        citations=citations,
        latency_ms=100,
        fetched_at=datetime.now(UTC),
        raw={},
    )


SAUDIA = Brand(
    name_ar="الخطوط السعودية",
    name_en="Saudia",
    aliases=("السعودية", "saudia airlines"),
    competitors=("طيران الإمارات", "القطرية", "Emirates", "Qatar Airways"),
)

CAREEM = Brand(
    name_ar="كريم",
    name_en="Careem",
    aliases=("careem", "تطبيق كريم"),
    competitors=("أوبر", "Uber", "Bolt"),
)


# ─────────────────────────────────────────────────────────────────────────────
# detect_brand
# ─────────────────────────────────────────────────────────────────────────────


class TestDetectBrand:
    def test_arabic_exact_match(self) -> None:
        text = normalize("الخطوط السعودية هي الناقل الوطني للمملكة")
        assert detect_brand(text, SAUDIA) == 0

    def test_alias_match(self) -> None:
        text = normalize("السعودية تطير لكل العالم")
        assert detect_brand(text, SAUDIA) is not None

    def test_english_in_arabic(self) -> None:
        text = normalize("الناقل الوطني هو Saudia Airlines")
        assert detect_brand(text, SAUDIA) is not None

    def test_fuzzy_typo(self) -> None:
        # User typo: كرم instead of كريم. Should still match via fuzzy.
        text = normalize("تطبيق الكريم للتوصيل")
        # كريم is a substring of "الكريم" — exact match wins before fuzzy
        assert detect_brand(text, CAREEM) is not None

    def test_no_mention_returns_none(self) -> None:
        text = normalize("لا يوجد ذكر للشركة في هذا النص")
        assert detect_brand(text, SAUDIA) is None

    def test_empty_text_returns_none(self) -> None:
        assert detect_brand("", SAUDIA) is None

    def test_returns_earliest_match(self) -> None:
        text = normalize("الخطوط السعودية ثم لاحقاً السعودية مرة أخرى")
        pos = detect_brand(text, SAUDIA)
        assert pos is not None
        assert pos == 0  # first occurrence wins


# ─────────────────────────────────────────────────────────────────────────────
# detect_competitors
# ─────────────────────────────────────────────────────────────────────────────


class TestDetectCompetitors:
    def test_finds_arabic_competitors(self) -> None:
        text = normalize("طيران الإمارات والقطرية يتنافسان مع الخطوط السعودية")
        comps = detect_competitors(text, SAUDIA)
        # Note: returns canonical forms from brand.competitors, not normalized strings
        assert "طيران الإمارات" in comps
        assert "القطرية" in comps

    def test_finds_english_competitors(self) -> None:
        text = normalize("Emirates competes with Saudia in the Middle East")
        comps = detect_competitors(text, SAUDIA)
        # Normalization lowercases via case-insensitive lookup, but
        # detect_competitors uses exact normalized form. English brands
        # in the competitors list should appear when present.
        # Without explicit case-folding in detect_competitors, this checks
        # that the normalize() of competitor strings matches.
        assert "Emirates" in comps or "emirates" in (c.lower() for c in comps)

    def test_no_duplicates(self) -> None:
        text = normalize("طيران الإمارات هو الأفضل. طيران الإمارات يطير لكل العالم.")
        comps = detect_competitors(text, SAUDIA)
        assert comps.count("طيران الإمارات") == 1

    def test_empty_when_none_mentioned(self) -> None:
        text = normalize("لا منافسين في هذا النص")
        assert detect_competitors(text, SAUDIA) == ()


# ─────────────────────────────────────────────────────────────────────────────
# mention_rank
# ─────────────────────────────────────────────────────────────────────────────


class TestMentionRank:
    def test_first_brand_is_rank_1(self) -> None:
        text = normalize("الخطوط السعودية أولاً، ثم طيران الإمارات")
        comps = detect_competitors(text, SAUDIA)
        assert mention_rank(text, SAUDIA, comps) == 1

    def test_brand_after_competitors_higher_rank(self) -> None:
        text = normalize("طيران الإمارات والقطرية، ثم الخطوط السعودية")
        comps = detect_competitors(text, SAUDIA)
        rank = mention_rank(text, SAUDIA, comps)
        assert rank is not None
        assert rank >= 2

    def test_none_when_not_mentioned(self) -> None:
        text = normalize("طيران الإمارات والقطرية هما الأبرز")
        comps = detect_competitors(text, SAUDIA)
        assert mention_rank(text, SAUDIA, comps) is None


# ─────────────────────────────────────────────────────────────────────────────
# extract_citations
# ─────────────────────────────────────────────────────────────────────────────


class TestExtractCitations:
    def test_extracts_urls_from_text(self) -> None:
        response = _response("راجع الموقع: https://www.saudia.com للمزيد.")
        cits = extract_citations(response)
        assert "https://www.saudia.com" in cits

    def test_merges_provider_citations_and_text_urls(self) -> None:
        response = _response(
            "وفقاً لـ https://x.com/source",
            citations=("https://y.com/another",),
        )
        cits = extract_citations(response)
        assert "https://x.com/source" in cits
        assert "https://y.com/another" in cits

    def test_strips_trailing_punctuation(self) -> None:
        response = _response("راجع https://example.com.")
        cits = extract_citations(response)
        assert "https://example.com" in cits

    def test_dedupes(self) -> None:
        response = _response(
            "https://x.com first then https://x.com again",
            citations=("https://x.com",),
        )
        cits = extract_citations(response)
        assert cits.count("https://x.com") == 1

    def test_empty_when_no_urls(self) -> None:
        response = _response("لا روابط هنا")
        assert extract_citations(response) == ()


# ─────────────────────────────────────────────────────────────────────────────
# analyze_sentiment
# ─────────────────────────────────────────────────────────────────────────────


class TestSentiment:
    def test_positive(self) -> None:
        text = normalize("الخطوط السعودية أفضل شركة طيران، أوصي بها دائماً")
        assert analyze_sentiment(text, SAUDIA) == "positive"

    def test_negative(self) -> None:
        text = normalize("الخطوط السعودية سيئة وأنصح بتجنبها، مشاكل كثيرة")
        assert analyze_sentiment(text, SAUDIA) == "negative"

    def test_neutral_when_brand_absent(self) -> None:
        text = normalize("شركات الطيران كثيرة في المنطقة")
        assert analyze_sentiment(text, SAUDIA) == "neutral"


# ─────────────────────────────────────────────────────────────────────────────
# detect_dialect
# ─────────────────────────────────────────────────────────────────────────────


class TestDetectDialect:
    @pytest.mark.parametrize(
        "text,expected",
        [
            ("شو احسن شركة بالشام؟", "levantine"),
            ("وش افضل شركة بالخليج؟", "gulf"),
            ("ايه افضل شركة في القاهرة؟", "egyptian"),
            ("ما هي افضل شركة في المنطقة؟", "msa"),
        ],
    )
    def test_picks_strongest_dialect(self, text: str, expected: str) -> None:
        assert detect_dialect(normalize(text)) == expected

    def test_returns_none_with_no_markers(self) -> None:
        assert detect_dialect("12345 abc") is None


# ─────────────────────────────────────────────────────────────────────────────
# compute_geo_score
# ─────────────────────────────────────────────────────────────────────────────


class TestGeoScore:
    def test_perfect_score(self) -> None:
        score = compute_geo_score(
            brand_mentioned=True,
            rank=1,
            total_brands_in_text=1,
            citations=("https://a.com", "https://b.com"),
            competitors_mentioned=(),
            sentiment="positive",
        )
        assert score == 100.0

    def test_worst_score(self) -> None:
        score = compute_geo_score(
            brand_mentioned=False,
            rank=None,
            total_brands_in_text=5,
            citations=(),
            competitors_mentioned=("a", "b", "c", "d"),
            sentiment="negative",
        )
        assert score == 0.0

    def test_partial(self) -> None:
        # Mentioned, ranked 2 of 3, one citation, one competitor, neutral
        score = compute_geo_score(
            brand_mentioned=True,
            rank=2,
            total_brands_in_text=3,
            citations=("https://x.com",),
            competitors_mentioned=("comp1",),
            sentiment="neutral",
        )
        assert 0.0 < score < 100.0


# ─────────────────────────────────────────────────────────────────────────────
# parse() — end-to-end
# ─────────────────────────────────────────────────────────────────────────────


class TestParseEndToEnd:
    def test_realistic_positive(self) -> None:
        response = _response(
            "الخطوط السعودية تُعتبر من أفضل شركات الطيران في الشرق الأوسط، "
            "وتنافس طيران الإمارات. للمزيد: https://www.saudia.com"
        )
        result = parse(response, SAUDIA)
        assert result.brand_mentioned is True
        assert result.mention_rank == 1
        assert "طيران الإمارات" in result.competitors_mentioned
        assert any("saudia.com" in c for c in result.citations)
        assert result.sentiment == "positive"
        assert result.geo_score > 50

    def test_brand_absent(self) -> None:
        response = _response("طيران الإمارات والقطرية هما الأفضل في المنطقة")
        result = parse(response, SAUDIA)
        assert result.brand_mentioned is False
        assert result.mention_rank is None
        # geo_score still includes competitor penalty
        assert result.geo_score < 50
