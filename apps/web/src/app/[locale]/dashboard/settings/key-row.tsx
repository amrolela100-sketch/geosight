'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';

import type { StoredKeySummary, VaultProvider } from '@geosight/db';

import { deleteKeyAction, validateStoredKeyAction } from './actions';

const PROVIDER_LABELS: Record<VaultProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
};

export function VaultKeyRow({
  provider,
  stored,
}: {
  provider: VaultProvider;
  stored: StoredKeySummary | null;
}) {
  const t = useTranslations('Settings.row');
  const [isPending, startTransition] = useTransition();

  const status = !stored
    ? 'missing'
    : stored.isValid
      ? 'valid'
      : 'invalid';

  return (
    <div className="border-border bg-card/30 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="font-semibold">{PROVIDER_LABELS[provider]}</span>
          <StatusBadge status={status} />
        </div>
        {stored ? (
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
            <span className="font-mono">•••• {stored.lastFour}</span>
            {stored.label && <span>{stored.label}</span>}
            {stored.lastValidatedAt && (
              <span>
                {t('lastValidatedAt')}:{' '}
                {new Date(stored.lastValidatedAt).toLocaleString()}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">{t('noKey')}</span>
        )}
      </div>

      {stored && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await validateStoredKeyAction(provider);
              })
            }
            className="border-border bg-background hover:bg-card rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-60"
          >
            {isPending ? t('working') : t('validate')}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirm(t('confirmDelete'))) return;
              startTransition(async () => {
                await deleteKeyAction(provider);
              });
            }}
            className="text-destructive border-destructive/40 bg-destructive/10 hover:bg-destructive/20 rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-60"
          >
            {t('delete')}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: 'valid' | 'invalid' | 'missing' }) {
  const t = useTranslations('Settings.status');
  const styles: Record<typeof status, string> = {
    valid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    invalid: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    missing: 'border-white/15 bg-white/[0.04] text-muted-foreground',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${styles[status]}`}>
      {t(status)}
    </span>
  );
}
