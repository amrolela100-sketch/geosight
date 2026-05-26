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
      utmSource: new URLSearchParams(window.location.search).get('utm_source') ?? undefined,
      utmMedium: new URLSearchParams(window.location.search).get('utm_medium') ?? undefined,
      utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') ?? undefined,
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
      <div className="glass gemini-border shadow-soft flex w-full max-w-xl flex-col items-center gap-3 rounded-[28px] p-7 text-center">
        <div className="bg-primary/20 text-primary flex h-12 w-12 items-center justify-center rounded-full text-lg">
          +
        </div>
        <p className="text-lg font-semibold">{t('successTitle')}</p>
        <p className="text-muted-foreground max-w-md text-sm leading-6">{t('successBody')}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass gemini-border shadow-soft flex w-full max-w-xl flex-col gap-5 rounded-[32px] p-6 text-start md:p-7"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <p className="text-foreground text-sm font-medium">{t('title')}</p>
        <p className="text-muted-foreground text-sm leading-6">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">{t('fullName')}</span>
          <input
            name="fullName"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            className="bg-background/60 focus:border-primary focus:ring-primary rounded-2xl border border-white/10 px-4 py-3 text-sm outline-none transition focus:ring-1"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">{t('email')}</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="bg-background/60 focus:border-primary focus:ring-primary rounded-2xl border border-white/10 px-4 py-3 text-sm outline-none transition focus:ring-1"
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">{t('company')}</span>
        <input
          name="company"
          maxLength={160}
          autoComplete="organization"
          className="bg-background/60 focus:border-primary focus:ring-primary rounded-2xl border border-white/10 px-4 py-3 text-sm outline-none transition focus:ring-1"
        />
      </label>

      {errorMsg && (
        <p className="text-destructive text-xs" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className={cn(
          'shadow-glow bg-primary text-primary-foreground mt-1 rounded-full px-6 py-3 text-sm font-medium transition',
          status === 'submitting' ? 'opacity-60' : 'hover:-translate-y-0.5 hover:opacity-95',
        )}
      >
        {status === 'submitting' ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
