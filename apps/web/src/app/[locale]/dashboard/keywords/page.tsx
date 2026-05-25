import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { type Locale } from '@/i18n/config';

import { KeywordForm } from './keyword-form';
import { KeywordRow } from './keyword-row';
import { BrandFilter } from './brand-filter';
import { listBrandOptions, listKeywords } from './actions';

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

  const [brands, keywords] = await Promise.all([
    listBrandOptions(),
    listKeywords(brandId),
  ]);

  const prefix = locale === 'ar' ? '' : `/${locale}`;

  if (brands.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </header>
        <div className="rounded-xl border border-dashed border-border bg-card/20 p-12 text-center">
          <p className="text-sm text-muted-foreground">{t('noBrandsYet')}</p>
          <Link
            href={`${prefix}/dashboard/brands`}
            className="mt-4 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            {t('goToBrands')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="rounded-xl border border-border bg-card/40 p-6">
        <h2 className="text-lg font-semibold">{t('form.title')}</h2>
        <KeywordForm brands={brands} defaultBrandId={brandId} className="mt-4" />
      </section>

      <section className="flex flex-col gap-4">
        <BrandFilter brands={brands} selected={brandId} />
        {keywords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/20 p-10 text-center">
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {keywords.map((k) => (
              <KeywordRow key={k.id} keyword={k} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
