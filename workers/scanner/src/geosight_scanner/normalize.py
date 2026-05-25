"""Arabic text normalization.

This is the foundation every downstream parser step depends on. The same
normalization is applied to the response text AND to the brand strings being
searched for — both sides MUST go through the same pipeline.

Phase 0 is heuristic only. Phase 2 will add full morphological analysis
(stemming, root extraction) once the labeled test set is in place.
"""

from __future__ import annotations

import re
import unicodedata

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


def remove_diacritics(text: str) -> str:
    """Strip every Arabic diacritic mark."""
    return _DIACRITICS_RE.sub("", text)


def remove_tatweel(text: str) -> str:
    """Strip the kashida / tatweel decoration character."""
    return text.replace(_TATWEEL, "")


def normalize_digits(text: str) -> str:
    """Map Arabic-Indic and Eastern Arabic-Indic digits to ASCII 0-9."""
    return text.translate(_DIGIT_MAP)


def normalize_punctuation(text: str) -> str:
    """Map Arabic punctuation to ASCII equivalents."""
    return text.translate(_PUNCT_MAP)


def normalize_hamza(text: str) -> str:
    """Collapse all hamza-bearing alef forms to bare alef."""
    return text.translate(_HAMZA_MAP)


def normalize_yaa(text: str) -> str:
    """Collapse final-yaa and hamza-on-yaa to regular yaa."""
    return text.translate(_YAA_MAP)


def normalize_taa_marbuta(text: str) -> str:
    """Collapse taa marbuta to haa (handles ة / ه interchange)."""
    return text.translate(_TAA_MARBUTA_MAP)


def normalize_whitespace(text: str) -> str:
    """Collapse runs of whitespace to a single space and trim."""
    return _WS_RE.sub(" ", text).strip()


def normalize(text: str) -> str:
    """Apply the full Arabic normalization pipeline.

    Order matters: NFKC first to unify compatibility forms (e.g. Arabic
    presentation forms used by some PDFs), then diacritic/tatweel removal,
    then letter folding, then digits/punctuation, then whitespace.
    """
    if not text:
        return ""

    text = unicodedata.normalize("NFKC", text)
    text = remove_diacritics(text)
    text = remove_tatweel(text)
    text = normalize_hamza(text)
    text = normalize_yaa(text)
    text = normalize_taa_marbuta(text)
    text = normalize_digits(text)
    text = normalize_punctuation(text)
    text = normalize_whitespace(text)
    return text


def normalize_case_insensitive(text: str) -> str:
    """Normalize + lowercase. Use when matching brands that may appear in
    English-in-Arabic contexts (e.g. 'Samsung' inside an Arabic paragraph)."""
    return normalize(text).lower()
