'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { deleteKeywordAction, setKeywordActiveAction, type KeywordListItem } from './actions';

export function KeywordRow({ keyword }: { keyword: KeywordListItem }) {
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
    <article className="border-border bg-card/40 flex items-start justify-between gap-4 rounded-xl border p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-base font-medium">{keyword.queryText}</p>
        <p className="text-muted-foreground text-xs">
          {keyword.brandNameAr} <span className="opacity-60">/ {keyword.brandNameEn}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <Badge>{tLanguage(keyword.language)}</Badge>
          <Badge>{tDialect(keyword.dialect)}</Badge>
          <Badge>{tSchedule(keyword.schedule)}</Badge>
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

      <div className="flex shrink-0 items-center gap-2">
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-background text-muted-foreground rounded-md border px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}
