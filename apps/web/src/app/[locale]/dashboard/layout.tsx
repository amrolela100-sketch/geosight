import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { BarChart3, Building2, Gauge, Search, Settings, Swords } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { dirFor, type Locale } from '@/i18n/config';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const { userId } = await auth();
  if (!userId) {
    const prefix = locale === 'ar' ? '' : `/${locale}`;
    redirect(`${prefix}/sign-in`);
  }

  const t = await getTranslations('Dashboard');
  const direction = dirFor(locale);
  const prefix = locale === 'ar' ? '' : `/${locale}`;

  const navItems = [
    { href: `${prefix}/dashboard`, label: t('nav.overview'), icon: Gauge },
    { href: `${prefix}/dashboard/brands`, label: t('nav.brands'), icon: Building2 },
    { href: `${prefix}/dashboard/keywords`, label: t('nav.keywords'), icon: BarChart3 },
    { href: `${prefix}/dashboard/competitors`, label: t('nav.competitors'), icon: Swords },
    { href: `${prefix}/dashboard/settings`, label: t('nav.settings'), icon: Settings },
  ];

  return (
    <div className="dashboard-aura min-h-screen" dir={direction}>
      <div aria-hidden className="hero-grid pointer-events-none fixed inset-0 opacity-30" />
      <header className="bg-background/70 sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-4">
            <Link href={`${prefix}/dashboard`} className="flex items-center gap-3">
              <span className="gemini-border glass flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold text-white">
                GS
              </span>
              <span className="font-semibold text-white">{t('brand')}</span>
            </Link>
          </div>

          <nav className="order-3 flex w-full items-center gap-2 overflow-x-auto text-sm md:order-2 md:w-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 transition hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-white"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="order-2 flex items-center gap-3 md:order-3">
            <div className="text-muted-foreground hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm lg:flex">
              <Search className="h-4 w-4" aria-hidden />
              <span>{t('searchPlaceholder')}</span>
            </div>
            <UserButton
              appearance={{ elements: { avatarBox: 'h-9 w-9' } }}
              afterSignOutUrl={locale === 'ar' ? '/' : `/${locale}`}
            />
          </div>
        </div>
      </header>
      <main className="container relative z-10 flex-1 py-8 md:py-10">{children}</main>
    </div>
  );
}
