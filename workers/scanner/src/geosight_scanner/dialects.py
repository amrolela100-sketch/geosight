"""Dialect detection and small cross-dialect glossary.

This is intentionally marker-based for Phase 2 W10-W11. It gives the parser a
deterministic offline baseline before any heavier Arabic NLP model lands.
"""

from __future__ import annotations

from typing import Final

from geosight_scanner.normalize import normalize
from geosight_scanner.types import Dialect

DIALECT_MARKERS: Final[dict[Dialect, tuple[str, ...]]] = {
    "msa": (
        "هل",
        "ما هي",
        "ما هو",
        "اقترح",
        "اوصي",
        "ايهما",
        "تعد",
        "يعتبر",
    ),
    "gulf": (
        "وش",
        "ايش",
        "شلون",
        "زين",
        "وايد",
        "واجد",
        "هواي",
        "ابي",
        "حق",
    ),
    "levantine": (
        "شو",
        "هلق",
        "هلأ",
        "كتير",
        "منيح",
        "بدي",
        "عنجد",
        "قديش",
    ),
    "egyptian": (
        "ايه",
        "عايز",
        "عاوزه",
        "ازاي",
        "خالص",
        "اوي",
        "جامد",
        "دلوقتي",
    ),
}

DIALECT_GLOSSARY: Final[dict[str, tuple[str, ...]]] = {
    "what": ("ما", "ماذا", "وش", "ايش", "شو", "ايه"),
    "best": ("افضل", "احسن", "ازين", "الاقوى"),
    "recommend": ("اوصي", "انصح", "ارشح", "اقترح"),
    "now": ("الان", "هلق", "هلأ", "دلوقتي", "الحين"),
}


def detect_dialect(normalized_text: str) -> Dialect | None:
    """Pick the dialect whose normalized markers fire the most. Ties prefer MSA."""
    if not normalized_text:
        return None

    scores: dict[Dialect, int] = {dialect: 0 for dialect in DIALECT_MARKERS}
    for dialect, markers in DIALECT_MARKERS.items():
        for marker in markers:
            if normalize(marker) in normalized_text:
                scores[dialect] += 1

    if not any(scores.values()):
        return None

    priority: dict[Dialect, int] = {"msa": 0, "gulf": 1, "levantine": 1, "egyptian": 1}
    return max(scores, key=lambda dialect: (scores[dialect], -priority[dialect]))


def glossary_variants(term: str) -> tuple[str, ...]:
    """Return known dialect variants for a glossary concept or term."""
    normalized = normalize(term)
    for variants in DIALECT_GLOSSARY.values():
        normalized_variants = tuple(normalize(variant) for variant in variants)
        if normalized in normalized_variants:
            return normalized_variants
    return (normalized,)
