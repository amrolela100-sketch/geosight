import { BarChart3, Gauge, SearchX, Swords, TrendingUp } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from '@geosight/ui';

import { CompetitorMentionsTrend } from '@/components/charts/competitor-mentions-trend';

import { getCompetitorInsights, getCompetitorTrend } from '../queries';

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
};

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function fmtScore(value: number): string {
  return value.toFixed(1);
}

export default async function CompetitorsPage() {
  const [t, locale, insights, trend] = await Promise.all([
    getTranslations('Competitors'),
    getLocale(),
    getCompetitorInsights(),
    getCompetitorTrend(14),
  ]);

  const totalMentions = insights.reduce((sum, item) => sum + item.mentions, 0);
  const top = insights[0] ?? null;
  const avgPressure =
    insights.length === 0
      ? 0
      : insights.reduce((sum, item) => sum + item.aiShareOfVoice, 0) / insights.length;

  const stats = [
    {
      key: 'tracked' as const,
      value: insights.length.toLocaleString(locale),
      icon: Swords,
      tone: 'rose' as const,
    },
    {
      key: 'mentions' as const,
      value: totalMentions.toLocaleString(locale),
      icon: BarChart3,
      tone: 'violet' as const,
    },
    {
      key: 'pressure' as const,
      value: fmtPct(avgPressure),
      icon: TrendingUp,
      tone: 'blue' as const,
    },
    {
      key: 'topScore' as const,
      value: top ? fmtScore(top.avgGeoScore) : '0.0',
      icon: Gauge,
      tone: 'emerald' as const,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card variant="ambient" padding="lg">
        <div>
          <Badge tone="rose" size="sm">
            <Swords className="h-3.5 w-3.5" aria-hidden />
            {t('label')}
          </Badge>
          <PageHeader title={t('title')} subtitle={t('subtitle')} className="mt-4" />
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.key} variant="glass" padding="md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    {t(`stats.${stat.key}.label`)}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
                </div>
                <Badge tone={stat.tone} size="md">
                  <Icon className="h-4 w-4" aria-hidden />
                </Badge>
              </div>
              <p className="text-muted-foreground mt-3 text-xs leading-5">
                {t(`stats.${stat.key}.hint`)}
              </p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card variant="glass" padding="md">
          <CardHeader>
            <CardTitle>{t('trend.title')}</CardTitle>
            <CardDescription>{t('trend.subtitle')}</CardDescription>
          </CardHeader>
          <div className="mt-4">
            <CompetitorMentionsTrend
              data={trend}
              locale={locale}
              mentionsLabel={t('trend.mentionsLabel')}
              emptyLabel={t('trend.empty')}
            />
          </div>
        </Card>

        <Card variant="solid" padding="md">
          <CardHeader>
            <CardTitle>{t('leader.title')}</CardTitle>
            <CardDescription>{t('leader.subtitle')}</CardDescription>
          </CardHeader>
          {top ? (
            <div className="mt-5">
              <p className="text-3xl font-semibold text-white">{top.name}</p>
              <p className="text-muted-foreground mt-2 text-sm">
                {t('leader.copy', {
                  mentions: top.mentions,
                  share: fmtPct(top.aiShareOfVoice),
                })}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {top.providers.map((provider) => (
                  <Badge key={provider} size="sm">
                    {PROVIDER_LABELS[provider] ?? provider}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">{t('leader.empty')}</p>
          )}
        </Card>
      </section>

      <section>
        {insights.length === 0 ? (
          <EmptyState icon={SearchX} title={t('empty.title')} description={t('empty.subtitle')} />
        ) : (
          <div className="grid gap-3">
            {insights.map((item, index) => (
              <Card key={item.name} variant="solid" padding="md">
                <div className="grid gap-4 lg:grid-cols-[48px_1fr_320px] lg:items-center">
                  <div className="text-muted-foreground font-mono text-sm">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-white">{item.name}</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {item.brands.length > 0 ? item.brands.join(' / ') : t('table.noBrand')}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Metric label={t('table.mentions')} value={item.mentions} />
                    <Metric label={t('table.share')} value={fmtPct(item.aiShareOfVoice)} />
                    <Metric label={t('table.score')} value={fmtScore(item.avgGeoScore)} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-border bg-background/40 rounded-lg border px-2 py-2">
      <p className="text-sm font-semibold text-white">{value}</p>
      <p className="text-muted-foreground mt-0.5 text-[11px]">{label}</p>
    </div>
  );
}
