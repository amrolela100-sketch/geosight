'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { storeKeyAction, type VaultActionState } from './actions';

const INITIAL: VaultActionState = { ok: true };

function SubmitButton() {
  const t = useTranslations('Settings.form');
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

export function VaultKeyForm({ className }: { className?: string }) {
  const t = useTranslations('Settings.form');
  const tErr = useTranslations('Settings.errors');
  const [state, formAction] = useFormState(storeKeyAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && 'message' in state && state.message === 'key_stored') {
      formRef.current?.reset();
    }
  }, [state]);

  const fieldErrors = !state.ok && state.fieldErrors ? state.fieldErrors : null;
  const generalError = !state.ok && state.error !== 'validation_failed' ? tErr(state.error) : null;
  const success = state.ok && 'message' in state && state.message === 'key_stored';

  return (
    <form ref={formRef} action={formAction} className={cn('flex flex-col gap-4', className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-sm">{t('provider')}</span>
          <select
            name="provider"
            required
            defaultValue="openai"
            className="border-border bg-background text-foreground rounded-lg border px-3 py-2.5 text-sm"
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="perplexity">Perplexity</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-sm">{t('label')}</span>
          <input
            type="text"
            name="label"
            placeholder={t('labelPlaceholder')}
            maxLength={120}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 rounded-lg border px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-sm">{t('apiKey')}</span>
        <input
          type="password"
          name="apiKey"
          required
          minLength={8}
          maxLength={512}
          autoComplete="off"
          placeholder={t('apiKeyPlaceholder')}
          className="border-border bg-background text-foreground placeholder:text-muted-foreground/60 rounded-lg border px-3 py-2.5 font-mono text-sm"
        />
        <span className="text-muted-foreground/80 text-xs">{t('apiKeyHint')}</span>
        {fieldErrors?.apiKey && (
          <span className="text-destructive text-xs">{fieldErrors.apiKey.join(', ')}</span>
        )}
      </label>

      {generalError && (
        <p className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-sm">
          {generalError}
        </p>
      )}
      {success && (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {t('success')}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
