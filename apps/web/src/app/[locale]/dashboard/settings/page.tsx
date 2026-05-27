import { getTranslations } from 'next-intl/server';

import { listVaultKeys } from './actions';
import { VaultKeyForm } from './key-form';
import { VaultKeyRow } from './key-row';

const PROVIDERS = ['openai', 'gemini', 'perplexity'] as const;

export default async function SettingsPage() {
  const [t, keys] = await Promise.all([getTranslations('Settings'), listVaultKeys()]);

  const keyByProvider = new Map(keys.map((k) => [k.provider, k]));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="border-border bg-card/40 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">{t('form.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t('form.subtitle')}</p>
        <VaultKeyForm className="mt-4" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('list.title')}</h2>
        {PROVIDERS.map((provider) => {
          const stored = keyByProvider.get(provider) ?? null;
          return <VaultKeyRow key={provider} provider={provider} stored={stored} />;
        })}
      </section>
    </div>
  );
}
