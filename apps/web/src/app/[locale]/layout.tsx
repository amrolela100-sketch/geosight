import { ClerkProvider } from '@clerk/nextjs';
import { IBM_Plex_Sans_Arabic, Inter, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ThemeProvider } from '@/components/theme-provider';
import { dirFor, locales, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

const fontArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!locales.includes(rawLocale as Locale)) notFound();
  const locale = rawLocale as Locale;
  const direction = dirFor(locale);

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={direction}
      suppressHydrationWarning
      className={cn(fontArabic.variable, fontSans.variable, fontMono.variable)}
    >
      <body
        className={cn(
          'min-h-screen bg-background font-sans text-foreground',
          locale === 'ar' && 'font-arabic',
        )}
      >
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''}
          appearance={{ variables: { colorPrimary: 'hsl(165 82% 51%)' } }}
        >
          <NextIntlClientProvider messages={messages} locale={locale}>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
              {children}
            </ThemeProvider>
          </NextIntlClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
