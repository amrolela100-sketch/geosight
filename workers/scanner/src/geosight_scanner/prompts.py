"""Phase 0 probe set: 20 Arabic queries × 4 dialects × 5 target brands.

The probes are intentionally realistic — these are the kinds of questions an
end-user in the GCC / Levant / Egypt actually types into ChatGPT. If the
spike fails the accuracy gate on this set, the spike fails. The roadmap
will not move to Phase 1.
"""

from __future__ import annotations

from geosight_scanner.types import Brand, Probe

# ─────────────────────────────────────────────────────────────────────────────
# Brand fixtures
# ─────────────────────────────────────────────────────────────────────────────

SAUDIA = Brand(
    name_ar="الخطوط السعودية",
    name_en="Saudia",
    aliases=("السعودية", "saudi airlines", "saudia airlines"),
    competitors=("طيران الإمارات", "القطرية", "طيران الاتحاد", "Emirates", "Qatar Airways"),
)

ARAMCO = Brand(
    name_ar="أرامكو",
    name_en="Aramco",
    aliases=("أرامكو السعودية", "saudi aramco", "ارامكو"),
    competitors=("أدنوك", "قطر للطاقة", "Shell", "BP", "ExxonMobil"),
)

STC = Brand(
    name_ar="إس تي سي",
    name_en="STC",
    aliases=("الاتصالات السعودية", "stc", "اس تي سي"),
    competitors=("موبايلي", "زين", "Zain", "Mobily"),
)

CAREEM = Brand(
    name_ar="كريم",
    name_en="Careem",
    aliases=("careem", "تطبيق كريم"),
    competitors=("أوبر", "Uber", "بولت", "Bolt", "Jeeny"),
)

TALABAT = Brand(
    name_ar="طلبات",
    name_en="Talabat",
    aliases=("talabat", "تطبيق طلبات"),
    competitors=("هنقرستيشن", "جاهز", "Jahez", "HungerStation", "Deliveroo"),
)

ALL_BRANDS: tuple[Brand, ...] = (SAUDIA, ARAMCO, STC, CAREEM, TALABAT)


# ─────────────────────────────────────────────────────────────────────────────
# Probes
# ─────────────────────────────────────────────────────────────────────────────


PROBES: tuple[Probe, ...] = (
    # ── MSA ──────────────────────────────────────────────────────────────────
    Probe("msa-1", "msa", "ما هي أفضل شركة طيران في منطقة الشرق الأوسط؟", SAUDIA),
    Probe("msa-2", "msa", "أيهما أفضل لتوصيل السيارات في الخليج: كريم أم أوبر؟", CAREEM),
    Probe("msa-3", "msa", "ما هي أكبر شركة نفط في العالم العربي؟", ARAMCO),
    Probe("msa-4", "msa", "أوصني بأفضل شركة اتصالات في المملكة العربية السعودية.", STC),
    Probe("msa-5", "msa", "ما أفضل تطبيق لتوصيل الطعام في الخليج العربي؟", TALABAT),
    # ── Gulf ─────────────────────────────────────────────────────────────────
    Probe("gulf-1", "gulf", "وش أفضل شركة طيران بالسعودية؟", SAUDIA),
    Probe("gulf-2", "gulf", "أحسن تطبيق توصيل سيارات بالرياض كريم لو أوبر؟", CAREEM),
    Probe("gulf-3", "gulf", "وش أكبر شركة بترول بالسعودية؟", ARAMCO),
    Probe("gulf-4", "gulf", "مين أحسن مزود انترنت بالرياض؟", STC),
    Probe("gulf-5", "gulf", "أحسن تطبيق توصيل أكل بجدة وش هو؟", TALABAT),
    # ── Levantine ────────────────────────────────────────────────────────────
    Probe("lev-1", "levantine", "شو أحسن شركة طيران بتطير من بيروت للسعودية؟", SAUDIA),
    Probe("lev-2", "levantine", "شو أحسن تطبيق توصيل سيارات بعمان؟", CAREEM),
    Probe("lev-3", "levantine", "شو أكبر شركة نفط بالخليج؟", ARAMCO),
    Probe("lev-4", "levantine", "شو أحسن مزود اتصالات بالسعودية للسوريين؟", STC),
    Probe("lev-5", "levantine", "شو أحسن تطبيق توصيل أكل بالخليج؟", TALABAT),
    # ── Egyptian ─────────────────────────────────────────────────────────────
    Probe("eg-1", "egyptian", "إيه أحسن شركة طيران من القاهرة للرياض؟", SAUDIA),
    Probe("eg-2", "egyptian", "إيه أحسن تطبيق توصيل عربيات في القاهرة؟", CAREEM),
    Probe("eg-3", "egyptian", "إيه أكبر شركة بترول في المنطقة؟", ARAMCO),
    Probe("eg-4", "egyptian", "إيه أحسن شركة اتصالات في السعودية للمصريين هناك؟", STC),
    Probe("eg-5", "egyptian", "إيه أحسن تطبيق توصيل أكل في دبي؟", TALABAT),
)
