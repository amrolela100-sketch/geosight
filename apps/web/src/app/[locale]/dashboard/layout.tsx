import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
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
    { href: `${prefix}/dashboard`, label: t('nav.overview') },
    { href: `${prefix}/dashboard/brands`, label: t('nav.brands') },
    { href: `${prefix}/dashboard/keywords`, label: t('nav.keywords') },
  ];

  return (
    <div className="flex min-h-screen flex-col" dir={direction}>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-semibold tracking-tight">{t('brand')}</span>
            <nav className="flex items-center gap-5 text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground transition hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <UserButton
            appearance={{ elements: { avatarBox: 'h-8 w-8' } }}
            afterSignOutUrl={locale === 'ar' ? '/' : `/${locale}`}
          />
        </div>
      </header>
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
