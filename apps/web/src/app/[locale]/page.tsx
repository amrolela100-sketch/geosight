import Link from 'next/link';
import { useTranslations } from 'next-intl';

import {
  EditorialEyebrow,
  Masthead,
  RailText,
  SectionMarker,
  cn,
} from '@geosight/ui';

import { WaitlistForm } from '@/components/waitlist-form';

const providers = ['ChatGPT', 'Gemini', 'Perplexity'] as const;
const phaseKeys = ['prompt', 'dialect', 'brand', 'scoring'] as const;
const capabilityKeys = [0, 1, 2, 3] as const;
const labKeys = [0, 1, 2, 3, 4] as const;
const methodKeys = [0, 1, 2, 3] as const;
const tickerKeys = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function LandingPage() {
  const t = useTranslations('Landing.hero');
  const tDemo = useTranslations('Landing.demo');
  const tStats = useTranslations('Landing.stats');
  const tSim = useTranslations('Landing.simulation');
  const tEd = useTranslations('Editorial');
  const common = useTranslations('Common');
  const year = new Date().getFullYear();

  return (
    <div className="theme-paper relative min-h-screen overflow-hidden">
      {/* Sticky masthead — two thin rules, then a heavy serif title row */}
      <header className="bg-paper sticky top-0 z-30 border-b border-[var(--ink)]">
        <Masthead
          volume={tEd('masthead.volume')}
          issue={tEd('masthead.issue')}
          status={
            <EditorialEyebrow tone="coral" data-reveal>
              {tEd('masthead.live')}
            </EditorialEyebrow>
          }
          middle={tEd('masthead.license')}
        />
        <div className="container flex items-center justify-between gap-6 py-3">
          <Link
            href="/"
            className="display-serif flex items-baseline gap-2 text-2xl"
            aria-label={common('appName')}
          >
            <span>GeoSight</span>
            <span className="meta-mono">— {common('tagline')}</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {(['about', 'capabilities', 'method', 'lab', 'contact'] as const).map((key) => (
              <a
                key={key}
                href={`#${key}`}
                className="eyebrow-track hover:text-[var(--coral)] transition"
              >
                {tEd(`sections.${key}`)}
              </a>
            ))}
            <Link
              href="/sign-in"
              className="border-ink bg-ink text-paper border px-4 py-2 text-xs uppercase tracking-[0.18em] transition hover:bg-[var(--coral)] hover:border-[var(--coral)]"
            >
              {t('signIn')}
            </Link>
          </nav>
        </div>
      </header>

      {/* Vertical rails — decorative metadata on the page edges */}
      <RailText side="left">{tEd('rail.left')}</RailText>
      <RailText side="right">{tEd('rail.right')}</RailText>

      <main>
        {/* Hero — masthead-style title with stat sidebar */}
        <section className="container relative pt-12 pb-16 md:pt-20 md:pb-24">
          <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
            <div className="hero-copy flex flex-col gap-7">
              <EditorialEyebrow tone="coral" data-reveal>
                {t('eyebrow')}
              </EditorialEyebrow>
              <h1
                className="display-serif text-[44px] leading-[1.04] sm:text-6xl lg:text-7xl"
                data-reveal
              >
                {tEd('about.title')}
              </h1>
              <p
                className="max-w-xl text-base leading-7 text-[var(--ink-soft)] md:text-lg md:leading-8"
                data-reveal
              >
                {tEd('about.lede')}
              </p>

              <div className="flex flex-wrap items-center gap-4" data-reveal>
                <Link
                  href="#contact"
                  className="bg-coral text-paper px-6 py-3 text-xs uppercase tracking-[0.18em] transition hover:bg-[var(--coral-soft)]"
                >
                  {t('ctaPrimary')}
                </Link>
                <a
                  href="#method"
                  className="border-ink text-ink hover:bg-ink hover:text-paper border px-6 py-3 text-xs uppercase tracking-[0.18em] transition"
                >
                  {t('ctaSecondary')}
                </a>
              </div>

              <dl className="mt-2 grid grid-cols-3 gap-6 border-t border-[var(--line)] pt-6" data-reveal>
                {(['score', 'dialects', 'mentions'] as const).map((key) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <dt className="eyebrow-track">{tStats(`${key}.label`)}</dt>
                    <dd className="display-serif text-4xl">{tStats(`${key}.value`)}</dd>
                    <dd className="meta-mono">{tStats(`${key}.note`)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Right column — provider strip + sample-query card */}
            <aside className="flex flex-col gap-6" data-reveal>
              <div className="surface-bone p-6">
                <p className="eyebrow-track mb-3">{tDemo('label')}</p>
                <p className="display-serif text-xl leading-snug">
                  &laquo; {tDemo('queryExample')} &raquo;
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {providers.map((p) => (
                  <div
                    key={p}
                    className="border-ink/20 surface-paper-warm flex items-center justify-center border p-3"
                  >
                    <span className="meta-mono text-ink">{p}</span>
                  </div>
                ))}
              </div>
              <div className="surface-bone p-6">
                <p className="eyebrow-track mb-2">{tSim('orbLabel')}</p>
                <p className="display-serif text-6xl leading-none">{tStats('score.value')}</p>
                <p className="meta-mono mt-2">{tSim('phaseNote')}</p>
              </div>
            </aside>
          </div>

          {/* "From the field" coordinates ticker */}
          <div className="mt-14 overflow-hidden border-y border-[var(--line)] py-3">
            <div className="ticker-track">
              {[...tickerKeys, ...tickerKeys].map((i, idx) => (
                <span key={`${i}-${idx}`} className="meta-mono whitespace-nowrap">
                  {tEd(`ticker.${i}`)}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* I. Manifesto */}
        <section id="about" className="container py-16 md:py-20">
          <SectionMarker
            index={1}
            label={tEd('sections.about')}
            pagination={{ current: 1, total: 7 }}
          />
          <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_1.5fr]">
            <h2 className="display-serif text-3xl md:text-4xl" data-reveal>
              {tEd('about.title')}
            </h2>
            <p
              className="text-lg leading-8 text-[var(--ink-soft)] md:text-xl md:leading-9"
              data-reveal
            >
              {tEd('about.manifesto')}
            </p>
          </div>
        </section>

        {/* II. Capabilities */}
        <section id="capabilities" className="container py-16 md:py-20">
          <SectionMarker
            index={2}
            label={tEd('sections.capabilities')}
            pagination={{ current: 2, total: 7 }}
          />
          <h2 className="display-serif mt-10 text-3xl md:text-4xl" data-reveal>
            {tEd('capabilities.title')}
          </h2>
          <div className="mt-10 grid gap-px bg-[var(--line)] md:grid-cols-2">
            {capabilityKeys.map((i) => (
              <article
                key={i}
                className="bg-paper flex flex-col gap-3 p-7 transition hover:bg-[var(--bone)]"
                data-reveal
              >
                <div className="flex items-baseline gap-3">
                  <span className="display-serif text-coral text-3xl leading-none">
                    {tEd(`capabilities.items.${i}.tag`)}
                  </span>
                  <h3 className="display-serif text-2xl">
                    {tEd(`capabilities.items.${i}.name`)}
                  </h3>
                </div>
                <p className="text-base leading-7 text-[var(--ink-soft)]">
                  {tEd(`capabilities.items.${i}.body`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* III. Method — the loop */}
        <section id="method" className="container py-16 md:py-20">
          <SectionMarker
            index={3}
            label={tEd('sections.method')}
            pagination={{ current: 3, total: 7 }}
          />
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_2fr]">
            <div className="flex flex-col gap-3">
              <h2 className="display-serif text-3xl md:text-4xl" data-reveal>
                {tEd('method.title')}
              </h2>
              <p className="meta-mono" data-reveal>
                {tEd('method.subtitle')}
              </p>
            </div>
            <ol className="grid gap-px bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
              {methodKeys.map((i) => (
                <li
                  key={i}
                  className="bg-paper flex flex-col gap-3 p-6"
                  data-reveal
                >
                  <span className="meta-mono text-coral">
                    {tEd(`method.steps.${i}.tag`)} / {phaseKeys[i]}
                  </span>
                  <h3 className="display-serif text-xl">
                    {tEd(`method.steps.${i}.name`)}
                  </h3>
                  <p className="text-sm leading-6 text-[var(--ink-soft)]">
                    {tEd(`method.steps.${i}.body`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* IV. Lab */}
        <section id="lab" className="container py-16 md:py-20">
          <SectionMarker
            index={4}
            label={tEd('sections.lab')}
            pagination={{ current: 4, total: 7 }}
          />
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_2fr]">
            <div className="flex flex-col gap-3">
              <h2 className="display-serif text-3xl md:text-4xl" data-reveal>
                {tEd('lab.title')}
              </h2>
              <p className="meta-mono" data-reveal>
                {tEd('lab.subtitle')}
              </p>
            </div>
            <ul className="flex flex-col">
              {labKeys.map((i) => (
                <li
                  key={i}
                  className={cn(
                    'flex flex-col gap-2 border-t border-[var(--line)] py-5 sm:flex-row sm:items-baseline sm:gap-6',
                    i === labKeys.length - 1 && 'border-b',
                  )}
                  data-reveal
                >
                  <span className="meta-mono w-16 shrink-0">
                    {tEd(`lab.items.${i}.tag`)}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h3 className="display-serif text-xl">
                        {tEd(`lab.items.${i}.name`)}
                      </h3>
                      <span className="eyebrow-track eyebrow-track--coral">
                        {tEd(`lab.items.${i}.status`)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                      {tEd(`lab.items.${i}.body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* V. Contact */}
        <section id="contact" className="container py-16 md:py-24">
          <SectionMarker
            index={7}
            label={tEd('sections.contact')}
            pagination={{ current: 7, total: 7 }}
          />
          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
            <div className="flex flex-col gap-6">
              <h2 className="display-serif text-4xl md:text-5xl" data-reveal>
                {tEd('contact.title')}
              </h2>
              <p
                className="text-lg leading-8 text-[var(--ink-soft)]"
                data-reveal
              >
                {tEd('contact.subtitle')}
              </p>
            </div>
            <div className="flex justify-start lg:justify-end" data-reveal>
              <WaitlistForm />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--ink)]">
        <div className="container flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="meta-mono">{tEd('footer.rights', { year })}</p>
          <nav className="flex flex-wrap gap-5">
            {(['privacy', 'terms', 'docs'] as const).map((key) => (
              <a
                key={key}
                href={`/${key}`}
                className="eyebrow-track hover:text-[var(--coral)] transition"
              >
                {tEd(`footer.${key}`)}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
