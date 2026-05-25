import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
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

  return (
    <div className="flex min-h-screen flex-col" dir={direction}>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <span className="font-semibold tracking-tight">{t('brand')}</span>
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
