import {
  Activity,
  BarChart3,
  Clock3,
  Gauge,
  Plus,
  Radio,
  SearchX,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

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

import { type Locale } from '@/i18n/config';

import { BrandFilter } from './brand-filter';
import { KeywordForm } from './keyword-form';
import { KeywordRow } from './keyword-row';
import { listBrandOptions, listKeywords } from './actions';
import { getKeywordOpsSummary, getKeywordPerformance, getLatestScans } from '../queries';

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
};

function fmtScore(value: number): string {
  return value.toFixed(1);
}

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ brandId?: string }>;
}) {
  const [{ locale }, { brandId }, t] = await Promise.all([
    params,
    searchParams,
    getTranslations('Keywords'),
  ]);

  const [brands, keywords, summary, performance, latestScans] = await Promise.all([
    listBrandOptions(),
    listKeywords(brandId),
    getKeywordOpsSummary(),
    getKeywordPerformance(brandId),
    getLatestScans(6),
  ]);

  const prefix = locale === 'ar' ? '' : `/${locale}`;
  const keywordById = new Map(keywords.map((keyword) => [keyword.id, keyword]));

  const stats = [
    {
      key: 'active' as const,
      value: summary.activeKeywords,
      icon: Activity,
      tone: 'emerald' as const,
    },
    {
      key: 'avgScore' as const,
      value: fmtScore(summary.avgGeoScore),
      icon: Gauge,
      tone: 'blue' as const,
    },
    {
      key: 'mentions' as const,
      value: summary.brandMentions,
      icon: Sparkles,
      tone: 'violet' as const,
    },
    {
      key: 'neverScanned' as const,
      value: summary.neverScanned,
      icon: Clock3,
      tone: 'rose' as const,
    },
  ];

  if (brands.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <EmptyState
          icon={SearchX}
          title={t('noBrandsYet')}
          action={
            <Button asChild>
              <Link href={`${prefix}/dashboard/brands`}>{t('goToBrands')}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card variant="ambient" padding="lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge tone="blue" size="sm">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              {t('ops.label')}
            </Badge>
            <PageHeader title={t('title')} subtitle={t('subtitle')} className="mt-4" />
          </div>
          <Button asChild variant="secondary">
            <a href="#new-keyword">
              <Plus className="h-4 w-4" aria-hidden />
              {t('ops.add')}
            </a>
          </Button>
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
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {typeof stat.value === 'number'
                      ? stat.value.toLocaleString(locale)
                      : stat.value}
                  </p>
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

      <section id="new-keyword" className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card variant="solid" padding="lg">
          <CardHeader>
            <CardTitle>{t('form.title')}</CardTitle>
            <CardDescription>{t('form.subtitle')}</CardDescription>
          </CardHeader>
          <KeywordForm brands={brands} defaultBrandId={brandId} className="mt-5" />
        </Card>

        <Card variant="glass" padding="lg">
          <CardHeader>
            <CardTitle>{t('latest.title')}</CardTitle>
            <CardDescription>{t('latest.subtitle')}</CardDescription>
          </CardHeader>
          <div className="mt-5 flex flex-col gap-3">
            {latestScans.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">{t('latest.empty')}</p>
            ) : (
              latestScans.map((scan) => (
                <Link
                  key={scan.id}
                  href={`${prefix}/dashboard/scans/${scan.id}`}
                  className="border-border bg-background/40 hover:bg-white/[0.04] flex items-start justify-between gap-4 rounded-lg border p-3 transition"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{scan.queryText}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {scan.brandNameAr} / {PROVIDER_LABELS[scan.provider] ?? scan.provider}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-sm font-semibold text-white">{fmtScore(scan.geoScore)}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(scan.scannedAt).toLocaleDateString(locale, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">{t('performance.title')}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{t('performance.subtitle')}</p>
          </div>
          <BrandFilter brands={brands} selected={brandId} />
        </div>

        {performance.length === 0 ? (
          <EmptyState icon={Radio} title={t('empty')} />
        ) : (
          <div className="grid gap-3">
            {performance.map((item) => {
              const keyword = keywordById.get(item.id);
              if (!keyword) return null;
              return (
                <KeywordRow
                  key={item.id}
                  keyword={keyword}
                  performance={item}
                  scanHref={
                    item.latestScanId
                      ? `${prefix}/dashboard/scans/${item.latestScanId}`
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
