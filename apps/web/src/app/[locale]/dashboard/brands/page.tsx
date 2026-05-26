import { getTranslations } from 'next-intl/server';

import { BrandForm } from './brand-form';
import { BrandRow } from './brand-row';
import { listBrands } from './actions';

export default async function BrandsPage() {
  const [t, brands] = await Promise.all([getTranslations('Brands'), listBrands()]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="border-border bg-card/40 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">{t('form.title')}</h2>
        <BrandForm className="mt-4" />
      </section>

      <section className="flex flex-col gap-3">
        {brands.length === 0 ? (
          <div className="border-border bg-card/20 rounded-xl border border-dashed p-12 text-center">
            <p className="text-muted-foreground text-sm">{t('empty')}</p>
          </div>
        ) : (
          brands.map((b) => <BrandRow key={b.id} brand={b} />)
        )}
      </section>
    </div>
  );
}
