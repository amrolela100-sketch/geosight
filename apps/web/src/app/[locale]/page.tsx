import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { WaitlistForm } from '@/components/waitlist-form';

export default function LandingPage() {
  const t = useTranslations('Landing.hero');
  const common = useTranslations('Common');

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]"
      />

      <header className="container flex items-center justify-between py-6">
        <span className="font-arabic text-lg font-semibold tracking-tight">
          {common('appName')}
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden sm:inline">{common('tagline')}</span>
          <Link
            href="/sign-in"
            className="rounded-md border border-border bg-card/40 px-3 py-1.5 text-foreground transition hover:bg-card/70"
          >
            {t('signIn')}
          </Link>
        </div>
      </header>

      <section className="container flex flex-col items-center justify-center gap-8 py-24 text-center md:py-32">
        <span className="rounded-full border border-border bg-card/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          {t('eyebrow')}
        </span>

        <h1 className="max-w-4xl text-balance text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          {t('title')}
        </h1>

        <p className="max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
          {t('subtitle')}
        </p>

        <WaitlistForm />
      </section>
    </main>
  );
}
