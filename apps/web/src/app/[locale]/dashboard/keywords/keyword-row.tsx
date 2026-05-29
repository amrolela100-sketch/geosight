'use client';

import { ArrowUpRight, Gauge, Radio } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { Badge, Button } from '@geosight/ui';

import { cn } from '@/lib/utils';

import { deleteKeywordAction, setKeywordActiveAction, type KeywordListItem } from './actions';
import type { KeywordPerformance } from '../queries';

export function KeywordRow({
  keyword,
  performance,
  scanHref,
}: {
  keyword: KeywordListItem;
  performance?: KeywordPerformance;
  scanHref?: string;
}) {
  const t = useTranslations('Keywords.row');
  const tDialect = useTranslations('Keywords.dialects');
  const tLanguage = useTranslations('Keywords.languages');
  const tSchedule = useTranslations('Keywords.schedules');
  const tErr = useTranslations('Keywords.errors');
  const [isPending, startTransition] = useTransition();

  function handleToggle(): void {
    startTransition(async () => {
      const result = await setKeywordActiveAction(keyword.id, !keyword.isActive);
      if (!result.ok && typeof window !== 'undefined') window.alert(tErr(result.error));
    });
  }

  function handleDelete(): void {
    if (typeof window !== 'undefined' && !window.confirm(t('confirmDelete'))) return;
    startTransition(async () => {
      const result = await deleteKeywordAction(keyword.id);
      if (!result.ok && typeof window !== 'undefined') window.alert(tErr(result.error));
    });
  }

  return (
    <article className="border-border bg-card/40 grid gap-4 rounded-xl border p-4 lg:grid-cols-[1fr_280px_auto] lg:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-base font-medium">{keyword.queryText}</p>
        <p className="text-muted-foreground text-xs">
          {keyword.brandNameAr} <span className="opacity-60">/ {keyword.brandNameEn}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <Badge size="sm">{tLanguage(keyword.language)}</Badge>
          <Badge size="sm">{tDialect(keyword.dialect)}</Badge>
          <Badge size="sm">{tSchedule(keyword.schedule)}</Badge>
          {keyword.lastScannedAt && (
            <span className="text-muted-foreground">
              {t('lastScanned')}:{' '}
              {new Date(keyword.lastScannedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label={t('scans')} value={performance?.scanCount ?? 0} />
        <Metric label={t('avgScore')} value={(performance?.avgGeoScore ?? 0).toFixed(1)} />
        <Metric label={t('mentions')} value={performance?.brandMentions ?? 0} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {scanHref ? (
          <Button asChild variant="ghost" size="sm" aria-label={t('openScan')}>
            <Link href={scanHref}>
              <Gauge className="h-4 w-4" aria-hidden />
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        ) : (
          <span className="text-muted-foreground inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <Radio className="h-4 w-4" aria-hidden />
          </span>
        )}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs font-medium transition',
            keyword.isActive
              ? 'border-primary/40 text-primary hover:bg-primary/10'
              : 'border-border text-muted-foreground hover:bg-card',
            isPending && 'opacity-60',
          )}
        >
          {keyword.isActive ? t('active') : t('paused')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className={cn(
            'border-destructive/40 text-destructive rounded-md border px-3 py-1.5 text-xs font-medium transition',
            isPending ? 'opacity-60' : 'hover:bg-destructive/10',
          )}
        >
          {isPending ? t('deleting') : t('delete')}
        </button>
      </div>
    </article>
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
