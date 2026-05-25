import { useTranslations } from 'next-intl';

/** Phase 1 landing placeholder — proves RTL + dark theme + fonts + i18n
 * are wired correctly. The real marketing page lands in a follow-up turn. */
export default function LandingPage() {
  const t = useTranslations('Landing.hero');
  const common = useTranslations('Common');

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]"
      />

      <header className="container flex items-center justify-between py-6">
        <span className="font-arabic text-lg font-semibold tracking-tight">
          {common('appName')}
        </span>
        <span className="text-xs text-muted-foreground">{common('tagline')}</span>
      </header>

      <section className="container flex flex-col items-center justify-center gap-8 py-24 text-center md:py-32">
        <span className="rounded-full border border-border bg-card/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          {t('eyebrow')}
        </span>

        <h1 className="max-w-4xl text-balance text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          {t('title')}
        </h1>

        <p className="max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
          {t('subtitle')}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            {t('ctaPrimary')}
          </button>
          <button
            type="button"
            className="rounded-lg border border-border bg-card/40 px-6 py-3 text-sm font-medium text-foreground transition hover:bg-card/70"
          >
            {t('ctaSecondary')}
          </button>
        </div>
      </section>
    </main>
  );
}
