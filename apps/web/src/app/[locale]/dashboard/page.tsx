import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
  const t = await getTranslations('Dashboard');

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('welcomeTitle')}</h1>
        <p className="mt-2 text-muted-foreground">{t('welcomeSubtitle')}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(['brands', 'keywords', 'scans'] as const).map((key) => (
          <div
            key={key}
            className="rounded-xl border border-border bg-card/40 p-6"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t(`metrics.${key}.label`)}
            </p>
            <p className="mt-2 text-3xl font-semibold">0</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(`metrics.${key}.hint`)}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-dashed border-border bg-card/20 p-12 text-center">
        <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
      </section>
    </div>
  );
}
