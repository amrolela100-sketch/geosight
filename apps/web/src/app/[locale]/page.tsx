import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { WaitlistForm } from '@/components/waitlist-form';

const providers = ['ChatGPT', 'Gemini', 'Perplexity'] as const;
const statKeys = ['score', 'dialects', 'mentions'] as const;
const phaseKeys = ['prompt', 'dialect', 'brand', 'scoring'] as const;

export default function LandingPage() {
  const t = useTranslations('Landing.hero');
  const tDemo = useTranslations('Landing.demo');
  const tStats = useTranslations('Landing.stats');
  const tSim = useTranslations('Landing.simulation');
  const common = useTranslations('Common');

  return (
    <main className="relative min-h-screen overflow-hidden pb-20">
      <div
        aria-hidden
        className="hero-grid pointer-events-none absolute inset-0 -z-20 opacity-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(50%_52%_at_50%_0%,rgb(66_133_244_/_0.25),transparent_72%)]"
      />
      <div
        aria-hidden
        className="sparkle-dot left-[10%] top-24 h-2 w-2"
        style={{ animationDelay: '0s' }}
      />
      <div
        aria-hidden
        className="sparkle-dot right-[14%] top-40 h-1.5 w-1.5"
        style={{ animationDelay: '1.5s' }}
      />
      <div
        aria-hidden
        className="sparkle-dot bottom-[28%] left-[18%] h-1.5 w-1.5"
        style={{ animationDelay: '3s' }}
      />

      <header className="container flex items-center justify-between py-7">
        <div className="flex items-center gap-3">
          <div className="gemini-border glass flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold text-white">
            GS
          </div>
          <div>
            <p className="font-arabic text-base font-semibold text-white">{common('appName')}</p>
            <p className="text-muted-foreground text-xs">{common('tagline')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 md:flex">
            {providers.map((provider) => (
              <span
                key={provider}
                className="text-muted-foreground rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
              >
                {provider}
              </span>
            ))}
          </div>
          <Link
            href="/sign-in"
            className="glass rounded-full px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            {t('signIn')}
          </Link>
        </div>
      </header>

      <section className="container grid gap-12 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-20">
        <div className="flex flex-col gap-7">
          <span className="gemini-border inline-flex w-fit rounded-full px-4 py-1.5 text-xs font-medium text-white/80">
            {t('eyebrow')}
          </span>

          <div className="space-y-5">
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.05] text-white sm:text-5xl lg:text-7xl">
              <span className="text-gradient-gemini">{t('title')}</span>
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              {t('subtitle')}
            </p>
          </div>

          <div className="glass gemini-border flex max-w-2xl flex-wrap items-center gap-3 rounded-[30px] px-4 py-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase text-slate-400">{tDemo('label')}</p>
              <p className="mt-1 truncate text-sm text-white/90">{tDemo('queryExample')}</p>
            </div>
            <button className="shadow-glow bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-medium transition hover:-translate-y-0.5">
              {t('ctaPrimary')}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {statKeys.map((key) => (
              <div key={key} className="glass rounded-[24px] p-4">
                <p className="text-xs uppercase text-slate-400">{tStats(`${key}.label`)}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{tStats(`${key}.value`)}</p>
                <p className="mt-1 text-sm text-slate-300">{tStats(`${key}.note`)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="mesh-panel glass shadow-soft rounded-[36px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">{tSim('title')}</p>
                <p className="mt-1 text-sm text-slate-300">{tSim('subtitle')}</p>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                {tSim('live')}
              </span>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="orb-surface shadow-glow flex aspect-square w-44 items-center justify-center">
                  <div className="text-center">
                    <p className="text-xs uppercase text-white/70">{tSim('orbLabel')}</p>
                    <p className="mt-2 text-5xl font-semibold text-white">
                      {tStats('score.value')}
                    </p>
                  </div>
                </div>
                <div className="grid w-full grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-2xl bg-white/5 px-3 py-2 text-slate-300">GPT</div>
                  <div className="rounded-2xl bg-white/5 px-3 py-2 text-slate-300">Gemini</div>
                  <div className="rounded-2xl bg-white/5 px-3 py-2 text-slate-300">PPX</div>
                </div>
              </div>

              <div className="space-y-4">
                {phaseKeys.map((phase, index) => (
                  <div key={phase} className="glass rounded-[24px] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">{tSim(`phases.${phase}`)}</p>
                        <p className="mt-1 text-xs text-slate-400">{tSim('phaseNote')}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-300">0{index + 1}</span>
                    </div>
                    <div className="shimmer-bar mt-4 h-2 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-8 flex justify-center">
        <WaitlistForm />
      </section>
    </main>
  );
}
