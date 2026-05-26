'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { createKeywordAction, type ActionState, type BrandOption } from './actions';

const INITIAL: ActionState = { ok: true };

const LANGUAGES = ['ar', 'en'] as const;
const DIALECTS = ['auto', 'msa', 'gulf', 'levantine', 'egyptian'] as const;
const SCHEDULES = ['daily', 'weekly', 'custom'] as const;

function SubmitButton() {
  const t = useTranslations('Keywords.form');
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'bg-primary text-primary-foreground shadow-glow mt-2 rounded-lg px-5 py-2.5 text-sm font-medium transition',
        pending ? 'opacity-60' : 'hover:opacity-90',
      )}
    >
      {pending ? t('submitting') : t('submit')}
    </button>
  );
}

export function KeywordForm({
  brands,
  defaultBrandId,
  className,
}: {
  brands: BrandOption[];
  defaultBrandId?: string;
  className?: string;
}) {
  const t = useTranslations('Keywords.form');
  const tDialect = useTranslations('Keywords.dialects');
  const tLanguage = useTranslations('Keywords.languages');
  const tSchedule = useTranslations('Keywords.schedules');
  const tErr = useTranslations('Keywords.errors');
  const [state, formAction] = useFormState(createKeywordAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && 'message' in state && state.message === 'keyword_created') {
      // Preserve brand/language/dialect selection so the user can add several
      // keywords for the same brand quickly. Only clear the queryText field.
      const queryInput =
        formRef.current?.querySelector<HTMLInputElement>('input[name="queryText"]');
      if (queryInput) queryInput.value = '';
    }
  }, [state]);

  const fieldErrors = !state.ok && state.fieldErrors ? state.fieldErrors : null;
  const generalError = !state.ok && state.error !== 'validation_failed' ? tErr(state.error) : null;

  return (
    <form ref={formRef} action={formAction} className={cn('flex flex-col gap-4', className)}>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t('brand')}</span>
        <select
          name="brandId"
          defaultValue={defaultBrandId ?? brands[0]?.id}
          required
          className="border-border bg-background focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nameAr} / {b.nameEn}
            </option>
          ))}
        </select>
        {fieldErrors?.brandId && (
          <span className="text-destructive text-xs" role="alert">
            {fieldErrors.brandId[0]}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t('queryText')}</span>
        <input
          name="queryText"
          required
          maxLength={280}
          placeholder={t('queryTextPlaceholder')}
          className="border-border bg-background focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
        />
        <span className="text-muted-foreground text-xs">{t('queryTextHint')}</span>
        {fieldErrors?.queryText && (
          <span className="text-destructive text-xs" role="alert">
            {fieldErrors.queryText[0]}
          </span>
        )}
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t('language')}</span>
          <select
            name="language"
            defaultValue="ar"
            className="border-border bg-background focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {tLanguage(lang)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t('dialect')}</span>
          <select
            name="dialect"
            defaultValue="auto"
            className="border-border bg-background focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
          >
            {DIALECTS.map((d) => (
              <option key={d} value={d}>
                {tDialect(d)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t('schedule')}</span>
          <select
            name="schedule"
            defaultValue="daily"
            className="border-border bg-background focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
          >
            {SCHEDULES.map((s) => (
              <option key={s} value={s}>
                {tSchedule(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked
          className="border-border bg-background text-primary focus:ring-primary h-4 w-4 rounded focus:ring-1"
        />
        <span className="font-medium">{t('isActive')}</span>
      </label>

      {generalError && (
        <p className="text-destructive text-xs" role="alert">
          {generalError}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
