'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { deleteBrandAction, type BrandListItem } from './actions';

export function BrandRow({ brand }: { brand: BrandListItem }) {
  const t = useTranslations('Brands.row');
  const tErr = useTranslations('Brands.errors');
  const [isPending, startTransition] = useTransition();

  function handleDelete(): void {
    if (typeof window !== 'undefined' && !window.confirm(t('confirmDelete'))) return;
    startTransition(async () => {
      const result = await deleteBrandAction(brand.id);
      if (!result.ok) {
        // surface error via a simple alert — Phase 1d will swap this for a
        // toast component.
        if (typeof window !== 'undefined') window.alert(tErr(result.error));
      }
    });
  }

  return (
    <article className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold">
            {brand.nameAr} <span className="text-muted-foreground">/ {brand.nameEn}</span>
          </h3>
          {brand.industry && (
            <p className="text-xs text-muted-foreground">{brand.industry}</p>
          )}
          {brand.website && (
            <a
              href={brand.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              {brand.website}
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className={cn(
            'rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition',
            isPending ? 'opacity-60' : 'hover:bg-destructive/10',
          )}
        >
          {isPending ? t('deleting') : t('delete')}
        </button>
      </div>

      {(brand.aliasesAr.length > 0 || brand.aliasesEn.length > 0) && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium">{t('aliases')}: </span>
          {[...brand.aliasesAr, ...brand.aliasesEn].join('، ')}
        </p>
      )}
      {brand.competitors.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium">{t('competitors')}: </span>
          {brand.competitors.join('، ')}
        </p>
      )}
    </article>
  );
}
