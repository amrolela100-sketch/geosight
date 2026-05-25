"""Fixture-based provider for offline Phase 0 exercise.

Lets the entire pipeline (CLI → provider → parser → CSV/JSON output) run
without spending a dollar on real provider calls or requiring API keys.
The fixtures are realistic — they mimic what each provider tends to return
for the probe set in geosight_scanner.prompts.

The fixture text is hand-curated to deliberately exercise:
- target brand present / absent
- competitors present / absent
- dialect markers
- citations (Perplexity-style URLs, Gemini grounding chunks, OpenAI plain text)
- positive / neutral / negative sentiment
"""

from __future__ import annotations

import random
from datetime import UTC, datetime
from typing import Final

from geosight_scanner.providers.base import ProviderClient
from geosight_scanner.types import ProviderName, ProviderResponse

# Deterministic seed so spike runs are reproducible.
_RNG = random.Random(20260525)

# ─────────────────────────────────────────────────────────────────────────────
# Hand-curated response templates keyed by (probe_id, provider).
# Probe IDs come from geosight_scanner.prompts.PROBES.
# ─────────────────────────────────────────────────────────────────────────────

_OPENAI_RESPONSES: Final[dict[str, str]] = {
    # ── MSA ──────────────────────────────────────────────────────────────────
    "msa-1": (
        "تُعدّ الخطوط السعودية من أفضل شركات الطيران في منطقة الشرق الأوسط، "
        "وتتنافس بقوة مع طيران الإمارات والقطرية على حصة السوق. توفر الخطوط "
        "السعودية شبكة واسعة من الوجهات الدولية وأسطولاً حديثاً."
    ),
    "msa-2": (
        "كلٌ من كريم وأوبر يعملان في الخليج، لكن كريم يُعتبر الخيار الأفضل "
        "محلياً نظراً لتخصصه في الأسواق العربية ودعمه للغة العربية بشكل كامل. "
        "أوبر متوفر أيضاً لكن كريم أكثر انتشاراً في الرياض وجدة."
    ),
    "msa-3": (
        "أرامكو السعودية هي أكبر شركة نفط في العالم العربي، بل في العالم من "
        "حيث القيمة السوقية والإنتاج اليومي. تنافسها على المستوى الإقليمي "
        "أدنوك الإماراتية وقطر للطاقة."
    ),
    "msa-4": (
        "إس تي سي (الاتصالات السعودية) تُعدّ المزود الرائد لخدمات الاتصالات "
        "في المملكة العربية السعودية، تليها موبايلي وزين. تتميز STC بشبكة "
        "تغطية واسعة وسرعات إنترنت عالية."
    ),
    "msa-5": (
        "طلبات هو أكثر تطبيقات توصيل الطعام انتشاراً في دول الخليج العربي، "
        "تليه هنقرستيشن وجاهز في السوق السعودي. للمزيد من المعلومات يمكن "
        "زيارة https://www.talabat.com."
    ),
    # ── Gulf ─────────────────────────────────────────────────────────────────
    "gulf-1": (
        "وش رايك بالخطوط السعودية؟ تُعتبر من أفضل الشركات بالسعودية وتوفر "
        "رحلات لكل أنحاء العالم. هواي ناس يفضلونها على غيرها."
    ),
    "gulf-2": (
        "بالرياض كريم زين مرة وأحسن من أوبر، خاصة في التوصيل السريع. "
        "كريم يدعم الدفع نقداً ومدى وايد، وهذا يجذب المستخدمين السعوديين."
    ),
    "gulf-3": (
        "أرامكو طبعاً، ما في شركة بترول أكبر منها بالسعودية ولا بالعالم. "
        "أدنوك بالإمارات قوية بس ما توصل لحجم أرامكو."
    ),
    "gulf-4": (
        "إس تي سي هي الأحسن بالرياض بدون منازع. موبايلي وزين خيارات ثانية "
        "لكن STC الأقوى من حيث التغطية والسرعة."
    ),
    "gulf-5": (
        "بجدة طلبات هو الأكثر استخداماً. هنقرستيشن وجاهز موجودين بس طلبات "
        "أوسع انتشاراً وعنده عروض زينة."
    ),
    # ── Levantine ────────────────────────────────────────────────────────────
    "lev-1": (
        "شو رأيك بالخطوط السعودية؟ بتطير من بيروت للرياض كل يوم تقريباً، "
        "وأسعارها منيحة كتير مقارنة بطيران الشرق الأوسط."
    ),
    "lev-2": (
        "بعمان كريم هو الأكثر استخداماً، بدي قول إنه أحسن من أوبر بكتير "
        "لأن السواقين بيعرفوا المنطقة منيح. هلق صار في تطبيقات تانية كمان."
    ),
    "lev-3": (
        "أرامكو السعودية بدون شك، أكبر شركة نفط بالخليج وبالعالم. "
        "قطر للطاقة وأدنوك منافسين بس أرامكو الأولى."
    ),
    "lev-4": (
        "للسوريين بالسعودية، إس تي سي بتعطي أحسن باقات للمكالمات الدولية. "
        "موبايلي وزين خيارات تانية بس STC الأحسن للتواصل مع العائلة."
    ),
    "lev-5": (
        "بالخليج طلبات هو الأكثر شعبية. هنقرستيشن منيح كمان بالسعودية، "
        "بس طلبات بدي قول إنه الأول."
    ),
    # ── Egyptian ─────────────────────────────────────────────────────────────
    "eg-1": (
        "إيه رأيك في الخطوط السعودية؟ بتطير من القاهرة للرياض كل يوم، "
        "والأسعار معقولة خالص. مصر للطيران كمان بتعمل نفس الخط."
    ),
    "eg-2": (
        "في القاهرة، أوبر وكريم الاتنين منتشرين أوي. كريم بقى أحسن في "
        "الخدمة العربية، بس أوبر عنده عربيات أكتر."
    ),
    "eg-3": (
        "أكبر شركة بترول في المنطقة هي أرامكو السعودية بدون منافس. "
        "بعدها بتيجي أدنوك في الإمارات."
    ),
    "eg-4": (
        "للمصريين في السعودية، إس تي سي بتقدم باقات كويسة جداً للاتصال "
        "بمصر. موبايلي وزين كمان عندهم عروض حلوة بس STC الأحسن."
    ),
    "eg-5": (
        "في دبي طلبات هو الأكتر استخداماً، وكمان Deliveroo. بس طلبات "
        "بيغطي مناطق أكتر."
    ),
}


_GEMINI_RESPONSES: Final[dict[str, tuple[str, tuple[str, ...]]]] = {
    "msa-1": (
        "في منطقة الشرق الأوسط، تتنافس عدة شركات على لقب الأفضل. تُعدّ "
        "طيران الإمارات والقطرية من أبرز شركات الطيران، تليها الخطوط "
        "السعودية وطيران الاتحاد. كل شركة لها نقاط قوة مختلفة.",
        ("https://www.skytrax.com/airline-ratings",),
    ),
    "msa-2": (
        "كريم وأوبر يقدمان خدمات مماثلة في الخليج. كريم تأسس في دبي "
        "ويُعتبر أكثر تكيفاً مع السوق المحلي، بينما يوفر أوبر تجربة عالمية "
        "موحدة. الاختيار يعتمد على تفضيلاتك.",
        (),
    ),
    "msa-3": (
        "شركة أرامكو السعودية هي أكبر شركة نفط في العالم العربي وفي العالم "
        "بأكمله من حيث الإنتاج اليومي والاحتياطيات المؤكدة.",
        ("https://www.aramco.com",),
    ),
    "msa-4": (
        "في المملكة العربية السعودية، تُهيمن ثلاث شركات اتصالات رئيسية: "
        "إس تي سي وموبايلي وزين. تختلف الأفضلية حسب المنطقة والباقة المطلوبة.",
        (),
    ),
    "msa-5": (
        "أبرز تطبيقات توصيل الطعام في الخليج العربي تشمل طلبات وهنقرستيشن "
        "وجاهز ومرسول. طلبات الأكثر انتشاراً إقليمياً.",
        ("https://www.talabat.com", "https://www.hungerstation.com"),
    ),
    "gulf-1": (
        "بالسعودية، الخطوط السعودية هي الناقل الوطني والأكثر شعبية. "
        "في ناس يفضلون فلاي ناي للرحلات الداخلية الأرخص.",
        (),
    ),
    "gulf-2": (
        "بالرياض كريم وأوبر الاتنين شغالين. كريم بدأ هنا فمتجذر أكثر، "
        "بس أوبر زاد حصته السوقية مؤخراً.",
        (),
    ),
    "gulf-3": (
        "أرامكو السعودية بدون منافس، هي عملاق الطاقة في المملكة والعالم.",
        ("https://www.aramco.com/en/who-we-are",),
    ),
    "gulf-4": (
        "STC هي الأقوى بالرياض من حيث الشبكة، تليها موبايلي ثم زين.",
        (),
    ),
    "gulf-5": (
        "بجدة في عدة خيارات: طلبات، هنقرستيشن، جاهز، ومرسول. "
        "طلبات وهنقرستيشن الأكثر استخداماً.",
        (),
    ),
    "lev-1": (
        "في عدة شركات بتطير من بيروت للسعودية: الخطوط السعودية، "
        "طيران الشرق الأوسط، وفلاي دبي عبر دبي.",
        (),
    ),
    "lev-2": (
        "بعمان أوبر منتشر كمان وكتير مستخدمين بيفضلوه. كريم بدأ بيتراجع "
        "شوي بالأردن مقارنة بالسنوات الماضية.",
        (),
    ),
    "lev-3": (
        "أكبر شركة نفط بالخليج هي أرامكو السعودية، تليها أدنوك الإماراتية.",
        ("https://en.wikipedia.org/wiki/Saudi_Aramco",),
    ),
    "lev-4": (
        "للسوريين بالسعودية في خيارات: STC وموبايلي وزين. STC عندها "
        "باقات دولية ممتازة.",
        (),
    ),
    "lev-5": (
        "بالخليج طلبات هو الرائد، وهنقرستيشن قوي بالسعودية تحديداً.",
        (),
    ),
    "eg-1": (
        "من القاهرة للرياض في رحلات يومية على مصر للطيران والخطوط السعودية. "
        "الاتنين خيارات منتشرة.",
        (),
    ),
    "eg-2": (
        "في القاهرة كريم وأوبر الاتنين شائعين. أوبر عنده أسطول أكبر "
        "بس كريم بيركز على الخدمة المحلية.",
        (),
    ),
    "eg-3": (
        "أكبر شركة بترول في المنطقة هي أرامكو السعودية بفارق كبير.",
        ("https://www.aramco.com",),
    ),
    "eg-4": (
        "في السعودية في تلات شركات اتصالات رئيسية: STC وموبايلي وزين. "
        "STC الأكبر من حيث عدد المشتركين.",
        (),
    ),
    "eg-5": (
        "في دبي طلبات وDeliveroo الأكتر شعبية. طلبات أرخص شوية.",
        ("https://www.talabat.com",),
    ),
}


_PERPLEXITY_RESPONSES: Final[dict[str, tuple[str, tuple[str, ...]]]] = {
    "msa-1": (
        "وفقاً لتصنيفات Skytrax 2024، طيران الإمارات والقطرية تتصدران "
        "قائمة شركات الطيران في الشرق الأوسط، تليهما الخطوط السعودية "
        "وطيران الاتحاد. ([1][2])",
        ("https://www.skytrax.com/airline-ratings", "https://www.flightright.com/me-airlines"),
    ),
    "msa-2": (
        "كريم وأوبر يعملان في الخليج. كريم استحوذت عليها أوبر عام 2020 "
        "لكنها لا تزال تعمل كعلامة تجارية منفصلة. كريم أكثر شعبية محلياً.",
        ("https://www.careem.com/about", "https://en.wikipedia.org/wiki/Careem"),
    ),
    "msa-3": (
        "أرامكو السعودية هي أكبر شركة نفط في العالم العربي والعالم بأكمله. "
        "في 2024، حققت أرباحاً قياسية بلغت 121 مليار دولار.",
        ("https://www.aramco.com/en/investors", "https://www.reuters.com/business/energy/"),
    ),
    "msa-4": (
        "إس تي سي هي المزود الرائد للاتصالات في السعودية بحصة سوقية "
        "تتجاوز 40%، تليها موبايلي ثم زين.",
        ("https://www.stc.com.sa", "https://www.statista.com/topics/saudi-telecom/"),
    ),
    "msa-5": (
        "طلبات هي الأكثر انتشاراً إقليمياً (مملوكة لـ Delivery Hero)، "
        "تليها هنقرستيشن وجاهز في السوق السعودي تحديداً.",
        ("https://www.talabat.com", "https://www.hungerstation.com", "https://jahez.net"),
    ),
    "gulf-1": (
        "وش الأفضل بالسعودية؟ الخطوط السعودية كناقل وطني، وفلاي ناي "
        "كخيار اقتصادي، وفلاي دل للرحلات الإقليمية.",
        ("https://www.saudia.com",),
    ),
    "gulf-2": (
        "بالرياض كريم وأوبر الاتنين منتشرين. كريم زين للدفع نقداً ومدى، "
        "وأوبر أحياناً أرخص بأوقات الذروة.",
        ("https://www.careem.com",),
    ),
    "gulf-3": (
        "أرامكو السعودية، طبعاً. أكبر شركة بترول بالعالم بقيمة سوقية "
        "تتجاوز 2 تريليون دولار.",
        ("https://www.aramco.com",),
    ),
    "gulf-4": (
        "بالرياض STC هي الأقوى تغطية وسرعة. موبايلي وزين منافسات بس "
        "STC هي الأولى.",
        ("https://www.stc.com.sa",),
    ),
    "gulf-5": (
        "بجدة طلبات وهنقرستيشن الأكتر استخداماً. جاهز ومرسول كمان "
        "منافسين قويين.",
        ("https://www.talabat.com", "https://www.hungerstation.com"),
    ),
    "lev-1": (
        "من بيروت للسعودية في الخطوط السعودية وطيران الشرق الأوسط (MEA). "
        "الاتنين بيقدموا رحلات يومية.",
        ("https://www.mea.com.lb",),
    ),
    "lev-2": (
        "بعمان كريم وأوبر الاتنين متاحين. كريم أكثر شعبية للسواقين "
        "المحليين، أوبر للمسافرين الدوليين.",
        ("https://www.careem.com/jo",),
    ),
    "lev-3": (
        "أكبر شركة نفط بالخليج هي أرامكو السعودية بدون منافس. أدنوك "
        "في الإمارات بالمرتبة الثانية إقليمياً.",
        ("https://www.aramco.com", "https://www.adnoc.ae"),
    ),
    "lev-4": (
        "للسوريين بالسعودية، STC وموبايلي بيقدموا باقات دولية ممتازة. "
        "زين كمان عندها عروض جيدة للمكالمات الدولية.",
        ("https://www.stc.com.sa/content/stc/sa/en/personal/mobile/roaming.html",),
    ),
    "lev-5": (
        "بالخليج طلبات هو الأكتر انتشاراً، تليه هنقرستيشن بالسعودية "
        "ومرسول بمناطق معينة.",
        ("https://www.talabat.com",),
    ),
    "eg-1": (
        "من القاهرة للرياض، في مصر للطيران والخطوط السعودية كناقلين رئيسيين. "
        "فلاي دبي خيار غير مباشر عبر دبي.",
        ("https://www.egyptair.com", "https://www.saudia.com"),
    ),
    "eg-2": (
        "في القاهرة أوبر وكريم منافسين شرسين. أوبر عنده أسطول أكبر، "
        "كريم بيركز على خدمة العملاء بالعربي.",
        ("https://www.uber.com/eg", "https://www.careem.com/eg"),
    ),
    "eg-3": (
        "أكبر شركة بترول في الشرق الأوسط هي أرامكو السعودية، بفارق "
        "كبير عن أدنوك الإماراتية وقطر للطاقة.",
        ("https://www.aramco.com",),
    ),
    "eg-4": (
        "في السعودية للمصريين، STC هي الأكبر تليها موبايلي وزين. "
        "STC بتقدم باقات خاصة للمكالمات لمصر.",
        ("https://www.stc.com.sa",),
    ),
    "eg-5": (
        "في دبي، طلبات و Deliveroo و Careem NOW الأكتر استخداماً "
        "لتوصيل الأكل. طلبات الأرخص عموماً.",
        ("https://www.talabat.com/uae", "https://deliveroo.ae"),
    ),
}


# ─────────────────────────────────────────────────────────────────────────────
# Fixture client — drop-in ProviderClient that reads from the tables above.
# ─────────────────────────────────────────────────────────────────────────────


class FixtureClient(ProviderClient):
    """A ProviderClient that returns canned responses for known probe IDs.

    Construct one per ProviderName. The `prompt` arg to .query() is matched
    against the registered probe text (case-sensitive, exact). Unknown probes
    fall back to a synthetic "no data" response so the pipeline still produces
    a row instead of crashing.
    """

    def __init__(self, name: ProviderName) -> None:
        # Bypass the BYOK key check — fixtures don't talk to the network.
        # We still set the same attributes the base class would set, so
        # downstream code can introspect uniformly.
        self.name = name
        self._api_key = "fixture"
        self._timeout = 0.0
        self._latency_ms_jitter = (40, 220)

    async def query(self, prompt: str) -> ProviderResponse:
        text, citations = self._lookup(prompt)
        latency_ms = _RNG.randint(*self._latency_ms_jitter)
        return ProviderResponse(
            provider=self.name,
            text=text,
            citations=citations,
            latency_ms=latency_ms,
            fetched_at=datetime.now(UTC),
            raw={"fixture": True, "provider": self.name.value},
        )

    def _lookup(self, prompt: str) -> tuple[str, tuple[str, ...]]:
        probe_id = _resolve_probe_id(prompt)
        if probe_id is None:
            return (
                f"[fixture: no canned response for prompt] {prompt[:80]}",
                (),
            )

        if self.name is ProviderName.OPENAI:
            text = _OPENAI_RESPONSES.get(probe_id, "")
            return text, ()
        if self.name is ProviderName.GEMINI:
            text, cits = _GEMINI_RESPONSES.get(probe_id, ("", ()))
            return text, cits
        if self.name is ProviderName.PERPLEXITY:
            text, cits = _PERPLEXITY_RESPONSES.get(probe_id, ("", ()))
            return text, cits

        # Defensive: every ProviderName variant is handled above.
        return "", ()


def _resolve_probe_id(prompt: str) -> str | None:
    """Look up the probe id whose query text matches `prompt` exactly.

    Done lazily so prompts.py and fixtures.py don't form an import cycle.
    """
    from geosight_scanner.prompts import PROBES

    for probe in PROBES:
        if probe.query == prompt:
            return probe.id
    return None
