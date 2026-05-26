'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { createBrandAction, type ActionState } from './actions';

const INITIAL: ActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('Brands.form');
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

export function BrandForm({ className }: { className?: string }) {
  const t = useTranslations('Brands.form');
  const tErr = useTranslations('Brands.errors');
  const [state, formAction] = useFormState(createBrandAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && 'message' in state && state.message === 'brand_created') {
      formRef.current?.reset();
    }
  }, [state]);

  const fieldErrors = !state.ok && state.fieldErrors ? state.fieldErrors : null;
  const generalError = !state.ok && state.error !== 'validation_failed' ? tErr(state.error) : null;

  return (
    <form ref={formRef} action={formAction} className={cn('flex flex-col gap-4', className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="nameAr"
          label={t('nameAr')}
          hint={t('nameArHint')}
          errors={fieldErrors?.nameAr}
          required
        />
        <Field
          name="nameEn"
          label={t('nameEn')}
          hint={t('nameEnHint')}
          errors={fieldErrors?.nameEn}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea
          name="aliasesAr"
          label={t('aliasesAr')}
          hint={t('aliasesArHint')}
          errors={fieldErrors?.aliasesAr}
        />
        <TextArea
          name="aliasesEn"
          label={t('aliasesEn')}
          hint={t('aliasesEnHint')}
          errors={fieldErrors?.aliasesEn}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="website" type="url" label={t('website')} errors={fieldErrors?.website} />
        <Field name="industry" label={t('industry')} errors={fieldErrors?.industry} />
      </div>

      <TextArea
        name="competitors"
        label={t('competitors')}
        hint={t('competitorsHint')}
        errors={fieldErrors?.competitors}
      />

      {generalError && (
        <p className="text-destructive text-xs" role="alert">
          {generalError}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  errors,
  type = 'text',
  required = false,
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="border-border bg-background focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
      />
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      {errors && errors.length > 0 && (
        <span className="text-destructive text-xs" role="alert">
          {errors[0]}
        </span>
      )}
    </label>
  );
}

function TextArea({
  name,
  label,
  hint,
  errors,
}: {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        name={name}
        rows={2}
        className="border-border bg-background focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
      />
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      {errors && errors.length > 0 && (
        <span className="text-destructive text-xs" role="alert">
          {errors[0]}
        </span>
      )}
    </label>
  );
}
