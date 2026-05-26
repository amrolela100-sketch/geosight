'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type { BrandOption } from './actions';

export function BrandFilter({ brands, selected }: { brands: BrandOption[]; selected?: string }) {
  const t = useTranslations('Keywords.filter');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    const value = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value === '') params.delete('brandId');
    else params.set('brandId', value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <label className="font-medium" htmlFor="brand-filter">
        {t('label')}
      </label>
      <select
        id="brand-filter"
        value={selected ?? ''}
        onChange={handleChange}
        className="border-border bg-background focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
      >
        <option value="">{t('all')}</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nameAr} / {b.nameEn}
          </option>
        ))}
      </select>
    </div>
  );
}
