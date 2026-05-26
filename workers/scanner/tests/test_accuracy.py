"""Corpus-backed Arabic NLP accuracy gates."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from geosight_scanner.parse import parse
from geosight_scanner.types import Brand, ProviderName, ProviderResponse

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "corpus"


BRANDS: dict[str, Brand] = {
    "saudia": Brand(
        name_ar="الخطوط السعودية",
        name_en="Saudia",
        aliases=("السعودية", "saudia airlines"),
        competitors=("طيران الإمارات", "القطرية", "Emirates", "Qatar Airways"),
    ),
    "careem": Brand(
        name_ar="كريم",
        name_en="Careem",
        aliases=("careem", "تطبيق كريم"),
        competitors=("أوبر", "Uber", "Bolt"),
    ),
    "samsung": Brand(
        name_ar="سامسونج",
        name_en="Samsung",
        aliases=("سامسونغ", "samsung electronics"),
        competitors=("آبل", "Apple", "هواوي", "Huawei"),
    ),
    "aramco": Brand(
        name_ar="أرامكو السعودية",
        name_en="Aramco",
        aliases=("أرامكو", "aramco saudi"),
        competitors=("سابك", "Shell"),
    ),
}


@dataclass(frozen=True, slots=True)
class Accuracy:
    passed: int = 0
    total: int = 0

    @property
    def ratio(self) -> float:
        if self.total == 0:
            return 1.0
        return self.passed / self.total


def _response(text: str) -> ProviderResponse:
    return ProviderResponse(
        provider=ProviderName.OPENAI,
        text=text,
        citations=(),
        latency_ms=100,
        fetched_at=datetime.now(UTC),
        raw={},
    )


def _load_entries() -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for path in sorted(CORPUS.glob("*.jsonl")):
        with path.open("r", encoding="utf-8") as handle:
            entries.extend(json.loads(line) for line in handle if line.strip())
    return entries


def _expected(entry: dict[str, Any]) -> dict[str, Any]:
    expected = entry["expected"]
    assert isinstance(expected, dict)
    return cast(dict[str, Any], expected)


def _score(actual: list[bool]) -> Accuracy:
    return Accuracy(passed=sum(1 for item in actual if item), total=len(actual))


def test_corpus_accuracy_gates() -> None:
    entries = _load_entries()
    assert len(entries) == 240

    brand_msa: list[bool] = []
    brand_dialect: list[bool] = []
    citations: list[bool] = []
    competitors: list[bool] = []
    sentiments: list[bool] = []

    for entry in entries:
        slug = str(entry["target_brand"])
        brand = BRANDS[slug]
        result = parse(_response(str(entry["text"])), brand)
        expected = _expected(entry)

        mentioned_ok = result.brand_mentioned is expected["mentioned"]
        if entry["dialect"] == "msa":
            brand_msa.append(mentioned_ok)
        else:
            brand_dialect.append(mentioned_ok)

        expected_citations = set(expected["citations"])
        citations.append(expected_citations.issubset(set(result.citations)))

        expected_competitors = set(expected["competitors"])
        competitors.append(expected_competitors.issubset(set(result.competitors_mentioned)))

        expected_sentiment = expected["sentiment"]
        assert expected_sentiment in ("positive", "neutral", "negative")
        sentiments.append(result.sentiment == expected_sentiment)

    scores: dict[str, tuple[Accuracy, float]] = {
        "MSA brand detection": (_score(brand_msa), 0.95),
        "Dialect brand detection": (_score(brand_dialect), 0.85),
        "Citation extraction": (_score(citations), 0.95),
        "Competitor detection": (_score(competitors), 0.85),
        "Sentiment analysis": (_score(sentiments), 0.75),
    }

    failures = [
        f"{name}: {score.passed}/{score.total} = {score.ratio:.1%}, target {target:.0%}"
        for name, (score, target) in scores.items()
        if score.ratio < target
    ]
    assert not failures, "\n".join(failures)
