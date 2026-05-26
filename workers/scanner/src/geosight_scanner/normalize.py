"""Arabic text normalization.

The parser applies the same normalization to provider text, brand names,
aliases, and corpus expectations. Keep this module deterministic and
idempotent: downstream accuracy tests depend on repeatable canonical forms.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# Arabic diacritics (tashkeel) — fatha, damma, kasra, sukun, shadda, tanwin, etc.
_DIACRITICS_RE = re.compile(r"[ً-ْٰـ]")

# Tatweel / kashida (ـ) — pure decoration, must be stripped.
_TATWEEL = "ـ"

# Arabic-Indic and Eastern Arabic-Indic digits.
_DIGIT_MAP = str.maketrans(
    "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹",
    "01234567890123456789",
)

# Arabic punctuation → ASCII so regex/citation extraction behaves predictably.
_PUNCT_MAP = str.maketrans(
    {
        "،": ",",
        "؛": ";",
        "؟": "?",
        "٪": "%",
        "٬": ",",
        "٫": ".",
    }
)

# Hamza variants → bare alef. Aggressive but matches how Arabic speakers
# actually type queries and how LLMs frequently emit text.
_HAMZA_MAP = str.maketrans(
    {
        "إ": "ا",
        "أ": "ا",
        "آ": "ا",
        "ٱ": "ا",
        "ٲ": "ا",
        "ٳ": "ا",
    }
)

# Final yaa (ى) → regular yaa (ي). Egyptian and Levantine writers omit dots
# inconsistently.
_YAA_MAP = str.maketrans({"ى": "ي", "ئ": "ي"})

# Taa marbuta (ة) → haa (ه). Common in informal Egyptian writing; we collapse
# both forms to a single canonical so search still hits.
_TAA_MARBUTA_MAP = str.maketrans({"ة": "ه"})

# Multiple whitespace → single space.
_WS_RE = re.compile(r"\s+")

# Invisible join controls emitted by keyboards/copy-paste. They affect string
# matching but carry no signal for this parser.
_JOIN_CONTROLS_RE = re.compile(r"[\u200c\u200d\u200e\u200f\ufeff]")


@dataclass(frozen=True, slots=True)
class ArabicNormalizer:
    """Deterministic Arabic text normalizer used by all parser stages."""

    def remove_diacritics(self, text: str) -> str:
        """Strip every Arabic diacritic mark."""
        return _DIACRITICS_RE.sub("", text)

    def remove_tatweel(self, text: str) -> str:
        """Strip the kashida / tatweel decoration character."""
        return text.replace(_TATWEEL, "")

    def normalize_digits(self, text: str) -> str:
        """Map Arabic-Indic and Eastern Arabic-Indic digits to ASCII 0-9."""
        return text.translate(_DIGIT_MAP)

    def normalize_punctuation(self, text: str) -> str:
        """Map Arabic punctuation to ASCII equivalents."""
        return text.translate(_PUNCT_MAP)

    def normalize_hamza(self, text: str) -> str:
        """Collapse all hamza-bearing alef forms to bare alef."""
        return text.translate(_HAMZA_MAP)

    def normalize_yaa(self, text: str) -> str:
        """Collapse final-yaa and hamza-on-yaa to regular yaa."""
        return text.translate(_YAA_MAP)

    def normalize_taa_marbuta(self, text: str) -> str:
        """Collapse taa marbuta to haa for informal Arabic matching.

        This keeps backward compatibility with the Phase 0 corpus where both
        "شركة" and "شركه" are treated as one canonical form.
        """
        return text.translate(_TAA_MARBUTA_MAP)

    def strip_join_controls(self, text: str) -> str:
        """Remove ZWJ/ZWNJ and bidi marks that make visual text mismatch."""
        return _JOIN_CONTROLS_RE.sub("", text)

    def normalize_whitespace(self, text: str) -> str:
        """Collapse runs of whitespace to a single space and trim."""
        return _WS_RE.sub(" ", text).strip()

    def normalize(self, text: str) -> str:
        """Apply the full Arabic normalization pipeline."""
        if not text:
            return ""

        text = unicodedata.normalize("NFKC", text)
        text = self.strip_join_controls(text)
        text = self.remove_diacritics(text)
        text = self.remove_tatweel(text)
        text = self.normalize_hamza(text)
        text = self.normalize_yaa(text)
        text = self.normalize_taa_marbuta(text)
        text = self.normalize_digits(text)
        text = self.normalize_punctuation(text)
        text = self.normalize_whitespace(text)
        return text

    def normalize_case_insensitive(self, text: str) -> str:
        """Normalize + casefold for English-in-Arabic brand mentions."""
        return self.normalize(text).casefold()


DEFAULT_NORMALIZER = ArabicNormalizer()


def remove_diacritics(text: str) -> str:
    """Strip every Arabic diacritic mark."""
    return DEFAULT_NORMALIZER.remove_diacritics(text)


def remove_tatweel(text: str) -> str:
    """Strip the kashida / tatweel decoration character."""
    return DEFAULT_NORMALIZER.remove_tatweel(text)


def normalize_digits(text: str) -> str:
    """Map Arabic-Indic and Eastern Arabic-Indic digits to ASCII 0-9."""
    return DEFAULT_NORMALIZER.normalize_digits(text)


def normalize_punctuation(text: str) -> str:
    """Map Arabic punctuation to ASCII equivalents."""
    return DEFAULT_NORMALIZER.normalize_punctuation(text)


def normalize_hamza(text: str) -> str:
    """Collapse all hamza-bearing alef forms to bare alef."""
    return DEFAULT_NORMALIZER.normalize_hamza(text)


def normalize_yaa(text: str) -> str:
    """Collapse final-yaa and hamza-on-yaa to regular yaa."""
    return DEFAULT_NORMALIZER.normalize_yaa(text)


def normalize_taa_marbuta(text: str) -> str:
    """Collapse taa marbuta to haa (handles ة / ه interchange)."""
    return DEFAULT_NORMALIZER.normalize_taa_marbuta(text)


def strip_join_controls(text: str) -> str:
    """Remove ZWJ/ZWNJ and bidi marks."""
    return DEFAULT_NORMALIZER.strip_join_controls(text)


def normalize_whitespace(text: str) -> str:
    """Collapse runs of whitespace to a single space and trim."""
    return DEFAULT_NORMALIZER.normalize_whitespace(text)


def normalize(text: str) -> str:
    """Apply the full Arabic normalization pipeline.

    Order matters: NFKC first to unify compatibility forms (e.g. Arabic
    presentation forms used by some PDFs), then diacritic/tatweel removal,
    then letter folding, then digits/punctuation, then whitespace.
    """
    return DEFAULT_NORMALIZER.normalize(text)


def normalize_case_insensitive(text: str) -> str:
    """Normalize + lowercase. Use when matching brands that may appear in
    English-in-Arabic contexts (e.g. 'Samsung' inside an Arabic paragraph)."""
    return DEFAULT_NORMALIZER.normalize_case_insensitive(text)
