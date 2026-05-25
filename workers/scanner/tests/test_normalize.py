"""Arabic normalization tests — the foundation every parser step relies on."""

from __future__ import annotations

import pytest

from geosight_scanner.normalize import (
    normalize,
    normalize_digits,
    normalize_hamza,
    normalize_punctuation,
    normalize_taa_marbuta,
    normalize_whitespace,
    normalize_yaa,
    remove_diacritics,
    remove_tatweel,
)


class TestRemoveDiacritics:
    def test_strips_full_tashkeel(self) -> None:
        assert remove_diacritics("بِسْمِ اللَّهِ") == "بسم الله"

    def test_no_op_on_undecorated(self) -> None:
        assert remove_diacritics("بسم الله") == "بسم الله"

    def test_strips_dagger_alef(self) -> None:
        assert remove_diacritics("هَٰذَا") == "هذا"


class TestRemoveTatweel:
    def test_strips_kashida(self) -> None:
        assert remove_tatweel("عــــربي") == "عربي"

    def test_no_op_when_absent(self) -> None:
        assert remove_tatweel("عربي") == "عربي"


class TestNormalizeHamza:
    @pytest.mark.parametrize(
        "input_text,expected",
        [
            ("إلى", "الى"),
            ("أحمد", "احمد"),
            ("آمنة", "امنة"),
            ("ٱللّٰه", "اللّٰه"),  # alef wasla → alef
        ],
    )
    def test_collapses_to_bare_alef(self, input_text: str, expected: str) -> None:
        assert normalize_hamza(input_text) == expected


class TestNormalizeYaa:
    def test_final_yaa(self) -> None:
        assert normalize_yaa("على") == "علي"

    def test_hamza_on_yaa(self) -> None:
        assert normalize_yaa("شيئ") == "شيي"


class TestNormalizeTaaMarbuta:
    def test_collapses_taa_marbuta(self) -> None:
        assert normalize_taa_marbuta("شركة") == "شركه"

    def test_no_op_on_regular_haa(self) -> None:
        assert normalize_taa_marbuta("شركه") == "شركه"


class TestNormalizeDigits:
    def test_arabic_indic(self) -> None:
        assert normalize_digits("٢٠٢٦") == "2026"

    def test_eastern_arabic_indic(self) -> None:
        assert normalize_digits("۲۰۲۶") == "2026"

    def test_mixed_with_text(self) -> None:
        assert normalize_digits("سنة ٢٠٢٦") == "سنة 2026"


class TestNormalizePunctuation:
    def test_arabic_comma(self) -> None:
        assert normalize_punctuation("أ، ب") == "أ, ب"

    def test_arabic_question_mark(self) -> None:
        assert normalize_punctuation("ما هي؟") == "ما هي?"

    def test_arabic_semicolon(self) -> None:
        assert normalize_punctuation("أ؛ ب") == "أ; ب"


class TestNormalizeWhitespace:
    def test_collapses_runs(self) -> None:
        assert normalize_whitespace("a   b\t\tc\nd") == "a b c d"

    def test_trims(self) -> None:
        assert normalize_whitespace("   leading and trailing   ") == "leading and trailing"


class TestFullPipeline:
    """End-to-end checks on realistic LLM-emitted Arabic text."""

    def test_msa_paragraph(self) -> None:
        raw = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ — سَنَةُ ٢٠٢٦ مٌ"
        out = normalize(raw)
        assert "بسم الله الرحمن الرحيم" in out
        assert "2026" in out
        # tashkeel and tatweel must be gone
        assert "ـ" not in out
        assert "ِ" not in out

    def test_dialect_variants_normalize_to_same_form(self) -> None:
        # All three orthographic forms of "إلى" must collapse to the same string.
        assert normalize("إلى") == normalize("الى")
        assert normalize("على") == normalize("علي")  # final yaa collapse
        # "شركة" written with taa marbuta vs haa must match
        assert normalize("شركة") == normalize("شركه")

    def test_empty(self) -> None:
        assert normalize("") == ""

    def test_idempotent(self) -> None:
        sample = "أرامكو السعودية، أكبر شركة نفط في العالم."
        once = normalize(sample)
        twice = normalize(once)
        assert once == twice
