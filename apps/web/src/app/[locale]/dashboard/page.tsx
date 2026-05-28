import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Gauge,
  Radio,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from '@geosight/ui';

import { GeoScoreTrendChart } from '@/components/charts/geo-score-trend';
import { ProviderBreakdownChart } from '@/components/charts/provider-breakdown';

import { listBrands } from './brands/actions';
import { listKeywords } from './keywords/actions';
import {
  getGeoScoreTrend,
  getOverviewSummary,
  getProviderBreakdown,
  type ProviderShare,
} from './queries';

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
};

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtScore(n: number): string {
  return n.toFixed(1);
}

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <span aria-hidden>—</span>
        {label}
      </span>
    );
  }
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        positive ? 'text-emerald-300' : 'text-rose-300'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {`${positive ? '+' : ''}${value.toFixed(1)}%`}
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export default async function DashboardPage() {
  const [t, locale, brands, keywords, summary, trend, providers] = await Promise.all([
    getTranslations('Dashboard'),
    getLocale(),
    listBrands(),
    listKeywords(),
    getOverviewSummary(),
    getGeoScoreTrend(14),
    getProviderBreakdown(),
  ]);

  const prefix = locale === 'ar' ? '' : `/${locale}`;

  const kpiCards = [
    {
      key: 'geoScore' as const,
      icon: Gauge,
      value: fmtScore(summary.avgGeoScore),
      delta: summary.geoScoreDelta,
      tone: 'text-blue-200',
    },
    {
      key: 'shareOfVoice' as const,
      icon: TrendingUp,
      value: fmtPct(summary.aiShareOfVoice),
      delta: summary.sovDelta,
      tone: 'text-violet-200',
    },
    {
      key: 'mentions' as const,
      icon: Sparkles,
      value: summary.brandMentions.toLocaleString(locale),
      delta: null,
      tone: 'text-rose-200',
    },
    {
      key: 'scans' as const,
      icon: Radio,
      value: summary.totalScans.toLocaleString(locale),
      delta: null,
      tone: 'text-emerald-200',
    },
  ];

  const inventory = [
    { key: 'brands' as const, value: brands.length, icon: Building2 },
    { key: 'keywords' as const, value: keywords.length, icon: BarChart3 },
    { key: 'activeKeywords' as const, value: summary.activeKeywordsCount, icon: Users },
  ];

  const providerData = providers.map((p: ProviderShare) => ({
    provider: p.provider,
    label: PROVIDER_LABELS[p.provider] ?? p.provider,
    scans: p.scans,
    mentions: p.mentions,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Card variant="ambient" padding="lg">
        <div className="grid gap-6 lg:grid-cols-[1fr_260px] lg:items-center">
          <div className="min-w-0">
            <Badge tone="blue" size="sm">
              <Gauge className="h-3.5 w-3.5" aria-hidden />
              {t('overviewLabel')}
            </Badge>
            <PageHeader
              title={t('welcomeTitle')}
              subtitle={t('welcomeSubtitle')}
              className="mt-4"
            />
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`${prefix}/dashboard/brands`}>
                  {t('actions.addBrand')}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`${prefix}/dashboard/keywords`}>
                  {t('actions.addKeyword')}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[240px] flex-col items-center gap-3">
            <div className="orb-surface flex aspect-square w-36 items-center justify-center">
              <div className="text-center">
                <p className="text-xs text-white/70">{t('hero.scoreLabel')}</p>
                <p className="mt-1 text-4xl font-semibold text-white">
                  {fmtScore(summary.avgGeoScore)}
                </p>
              </div>
            </div>
            <div className="text-muted-foreground grid w-full grid-cols-3 gap-2 text-center text-xs">
              <span className="rounded-md border border-white/10 bg-white/[0.04] py-2">GPT</span>
              <span className="rounded-md border border-white/10 bg-white/[0.04] py-2">Gemini</span>
              <span className="rounded-md border border-white/10 bg-white/[0.04] py-2">PPX</span>
            </div>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key} variant="glass" padding="md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t(`kpi.${card.key}.label`)}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">{card.value}</p>
                  <div className="mt-2">
                    <Delta value={card.delta} label={t('kpi.delta14d')} />
                  </div>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] ${card.tone}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
              </div>
              <p className="text-muted-foreground mt-3 text-xs leading-5">
                {t(`kpi.${card.key}.hint`)}
              </p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card variant="glass" padding="md">
          <CardHeader>
            <CardTitle>{t('trend.title')}</CardTitle>
            <CardDescription>{t('trend.subtitle')}</CardDescription>
          </CardHeader>
          <div className="mt-4">
            <GeoScoreTrendChart
              data={trend}
              locale={locale}
              scoreLabel={t('trend.scoreLabel')}
              scansLabel={t('trend.scansLabel')}
              emptyLabel={t('trend.empty')}
            />
          </div>
        </Card>

        <Card variant="glass" padding="md">
          <CardHeader>
            <CardTitle>{t('providers.title')}</CardTitle>
            <CardDescription>{t('providers.subtitle')}</CardDescription>
          </CardHeader>
          <div className="mt-4">
            <ProviderBreakdownChart
              data={providerData}
              scansLabel={t('providers.scansLabel')}
              mentionsLabel={t('providers.mentionsLabel')}
              emptyLabel={t('providers.empty')}
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {inventory.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.key} variant="solid" padding="md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    {t(`inventory.${item.key}.label`)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {item.value.toLocaleString(locale)}
                  </p>
                </div>
                <Icon className="text-muted-foreground h-5 w-5" aria-hidden />
              </div>
              <p className="text-muted-foreground mt-3 text-xs leading-5">
                {t(`inventory.${item.key}.hint`)}
              </p>
            </Card>
          );
        })}
      </section>

      {brands.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('empty.title')}
          description={t('empty.subtitle')}
          action={
            <Button asChild>
              <Link href={`${prefix}/dashboard/brands`}>{t('actions.addBrand')}</Link>
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
