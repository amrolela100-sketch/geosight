'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function WaitlistForm() {
  const t = useTranslations('Landing.waitlist');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMsg(null);
    setStatus('submitting');

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      fullName: String(formData.get('fullName') ?? ''),
      email: String(formData.get('email') ?? ''),
      company: String(formData.get('company') ?? '') || undefined,
    };

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setErrorMsg(body?.error ?? t('errorGeneric'));
        setStatus('error');
        return;
      }
      form.reset();
      setStatus('success');
    } catch {
      setErrorMsg(t('errorGeneric'));
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-6 text-center">
        <p className="text-base font-semibold">{t('successTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('successBody')}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-card/40 p-6 text-start"
      noValidate
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t('fullName')}</span>
        <input
          name="fullName"
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t('email')}</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t('company')}</span>
        <input
          name="company"
          maxLength={160}
          autoComplete="organization"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </label>

      {errorMsg && (
        <p className="text-xs text-destructive" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className={cn(
          'mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition',
          status === 'submitting' ? 'opacity-60' : 'hover:opacity-90',
        )}
      >
        {status === 'submitting' ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
