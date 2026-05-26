import Link from 'next/link';
import { ArrowUpRight, BarChart3, Building2, Gauge, Radio } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { listBrands } from './brands/actions';
import { listKeywords } from './keywords/actions';

const scanPhases = ['providers', 'parser', 'dashboard'] as const;

export default async function DashboardPage() {
  const [t, locale, brands, keywords] = await Promise.all([
    getTranslations('Dashboard'),
    getLocale(),
    listBrands(),
    listKeywords(),
  ]);

  const prefix = locale === 'ar' ? '' : `/${locale}`;
  const activeKeywords = keywords.filter((keyword) => keyword.isActive).length;

  const metrics = [
    {
      key: 'brands',
      value: brands.length,
      icon: Building2,
      tone: 'from-blue-400/[0.18] to-blue-400/5 text-blue-200',
    },
    {
      key: 'keywords',
      value: keywords.length,
      icon: BarChart3,
      tone: 'from-violet-400/[0.18] to-violet-400/5 text-violet-200',
    },
    {
      key: 'scans',
      value: activeKeywords,
      icon: Radio,
      tone: 'from-rose-400/[0.18] to-rose-400/5 text-rose-200',
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <section className="gemini-border glass-panel rounded-lg p-5 md:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-center">
          <div className="min-w-0">
            <div className="text-muted-foreground inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs">
              <Gauge className="h-3.5 w-3.5 text-blue-200" aria-hidden />
              {t('overviewLabel')}
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold text-white md:text-4xl">
              {t('welcomeTitle')}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-7 md:text-base">
              {t('welcomeSubtitle')}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`${prefix}/dashboard/brands`}
                className="bg-primary text-primary-foreground shadow-glow inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition hover:-translate-y-0.5 hover:opacity-95"
              >
                {t('actions.addBrand')}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href={`${prefix}/dashboard/keywords`}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
              >
                {t('actions.addKeyword')}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[260px] flex-col items-center gap-3">
            <div className="orb-surface flex aspect-square w-36 items-center justify-center">
              <div className="text-center">
                <p className="text-xs text-white/70">GEO Score</p>
                <p className="mt-1 text-4xl font-semibold text-white">0</p>
              </div>
            </div>
            <div className="text-muted-foreground grid w-full grid-cols-3 gap-2 text-center text-xs">
              <span className="rounded-md border border-white/10 bg-white/[0.04] py-2">GPT</span>
              <span className="rounded-md border border-white/10 bg-white/[0.04] py-2">Gemini</span>
              <span className="rounded-md border border-white/10 bg-white/[0.04] py-2">PPX</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.key}
              className="glass-panel rounded-lg p-5 transition hover:border-white/[0.14]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    {t(`metrics.${metric.key}.label`)}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br ${metric.tone}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
              </div>
              <p className="text-muted-foreground mt-3 text-xs leading-5">
                {t(`metrics.${metric.key}.hint`)}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="glass-panel rounded-lg p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{t('readiness.title')}</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {t('readiness.subtitle')}
              </p>
            </div>
            <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-xs text-blue-100">
              Phase 1
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {scanPhases.map((phase, index) => (
              <div key={phase} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-white">
                    {index + 1}. {t(`readiness.items.${phase}`)}
                  </p>
                  <span className="text-muted-foreground text-xs">{t('readiness.ready')}</span>
                </div>
                <div className="shimmer-bar mt-3 h-1.5 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-lg p-5">
          <h2 className="text-lg font-semibold text-white">{t('next.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">{t('next.subtitle')}</p>
          <div className="mt-5 space-y-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <p className="text-sm font-medium text-white">{t('next.first')}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">{t('next.firstHint')}</p>
            </div>
            <div className="rounded-lg border border-dashed border-white/[0.12] bg-white/[0.025] p-4">
              <p className="text-muted-foreground text-sm">{t('emptyState')}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
