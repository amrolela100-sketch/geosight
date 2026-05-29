import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  ExternalLink,
  Gauge,
  Link2,
  Quote,
  SearchX,
  Swords,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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

import { getScanDetail } from '../../queries';

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
};

function fmtScore(value: number): string {
  return value.toFixed(1);
}

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; scanId: string }>;
}) {
  const [{ locale, scanId }, t] = await Promise.all([params, getTranslations('Scans')]);
  const scan = await getScanDetail(scanId);
  const prefix = locale === 'ar' ? '' : `/${locale}`;

  if (!scan) notFound();

  const rawPreview = JSON.stringify(scan.rawResponse, null, 2);

  const metrics = [
    {
      key: 'score' as const,
      value: fmtScore(scan.geoScore),
      icon: Gauge,
      tone: 'blue' as const,
    },
    {
      key: 'mention' as const,
      value: scan.brandMentioned ? t('yes') : t('no'),
      icon: BadgeCheck,
      tone: scan.brandMentioned ? ('emerald' as const) : ('rose' as const),
    },
    {
      key: 'rank' as const,
      value: scan.mentionRank ? `#${scan.mentionRank}` : t('none'),
      icon: Quote,
      tone: 'violet' as const,
    },
    {
      key: 'latency' as const,
      value: `${scan.latencyMs.toLocaleString(locale)} ms`,
      icon: Clock3,
      tone: 'rose' as const,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href={`${prefix}/dashboard/keywords`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('back')}
        </Link>
      </Button>

      <Card variant="ambient" padding="lg">
        <div className="grid gap-6 lg:grid-cols-[1fr_240px] lg:items-center">
          <div>
            <Badge tone="blue" size="sm">
              {PROVIDER_LABELS[scan.provider] ?? scan.provider}
            </Badge>
            <PageHeader title={scan.queryText} subtitle={t('subtitle')} className="mt-4" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge size="sm">{scan.brandNameAr}</Badge>
              <Badge size="sm">{scan.brandNameEn}</Badge>
              <Badge size="sm">{scan.sentiment}</Badge>
              {scan.detectedDialect ? <Badge size="sm">{scan.detectedDialect}</Badge> : null}
            </div>
          </div>
          <div className="orb-surface mx-auto flex aspect-square w-36 items-center justify-center">
            <div className="text-center">
              <p className="text-xs text-white/70">{t('metrics.score.label')}</p>
              <p className="mt-1 text-4xl font-semibold text-white">{fmtScore(scan.geoScore)}</p>
            </div>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.key} variant="glass" padding="md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    {t(`metrics.${metric.key}.label`)}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">{metric.value}</p>
                </div>
                <Badge tone={metric.tone} size="md">
                  <Icon className="h-4 w-4" aria-hidden />
                </Badge>
              </div>
              <p className="text-muted-foreground mt-3 text-xs leading-5">
                {t(`metrics.${metric.key}.hint`)}
              </p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card variant="solid" padding="lg">
          <CardHeader>
            <CardTitle>{t('snippet.title')}</CardTitle>
            <CardDescription>{t('snippet.subtitle')}</CardDescription>
          </CardHeader>
          {scan.contextSnippet ? (
            <blockquote className="border-primary/40 bg-background/40 mt-5 rounded-xl border p-5 text-sm leading-7 text-white">
              {scan.contextSnippet}
            </blockquote>
          ) : (
            <EmptyState icon={SearchX} title={t('snippet.empty')} className="mt-5" />
          )}
        </Card>

        <Card variant="glass" padding="lg">
          <CardHeader>
            <CardTitle>{t('entities.title')}</CardTitle>
            <CardDescription>{t('entities.subtitle')}</CardDescription>
          </CardHeader>
          <div className="mt-5 flex flex-col gap-5">
            <EntityList
              icon={Swords}
              title={t('entities.competitors')}
              empty={t('entities.noCompetitors')}
              items={scan.competitorsMentioned}
            />
            <EntityList
              icon={Link2}
              title={t('entities.citations')}
              empty={t('entities.noCitations')}
              items={scan.citations}
              links
            />
          </div>
        </Card>
      </section>

      <Card variant="solid" padding="lg">
        <CardHeader>
          <CardTitle>{t('raw.title')}</CardTitle>
          <CardDescription>{t('raw.subtitle')}</CardDescription>
        </CardHeader>
        <pre className="border-border bg-background/60 text-muted-foreground mt-5 max-h-[420px] overflow-auto rounded-xl border p-4 text-xs leading-6">
          {rawPreview}
        </pre>
      </Card>
    </div>
  );
}

function EntityList({
  icon: Icon,
  title,
  empty,
  items,
  links,
}: {
  icon: typeof Swords;
  title: string;
  empty: string;
  items: string[];
  links?: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="text-muted-foreground h-4 w-4" aria-hidden />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) =>
            links ? (
              <a
                key={item}
                href={item}
                target="_blank"
                rel="noreferrer"
                className="border-border bg-background/40 hover:border-primary/40 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-3 py-1 text-xs text-white transition"
              >
                <span className="truncate">{item}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              </a>
            ) : (
              <Badge key={item} size="sm">
                {item}
              </Badge>
            ),
          )}
        </div>
      )}
    </div>
  );
}
