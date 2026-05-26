import { ClerkProvider } from '@clerk/nextjs';
import { IBM_Plex_Sans_Arabic, Inter, JetBrains_Mono } from 'next/font/google';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AnalyticsProvider } from '@/components/analytics-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { defaultLocale, dirFor, locales, type Locale } from '@/i18n/config';
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = locales.includes(rawLocale as Locale) ? (rawLocale as Locale) : defaultLocale;
  const isArabic = locale === 'ar';
  const title = isArabic
    ? 'GeoSight — قياس ظهور علامتك في إجابات الذكاء الاصطناعي'
    : 'GeoSight — Measure your brand visibility in AI answers';
  const description = isArabic
    ? 'منصة GEO عربية لتتبع ظهور علامتك في ChatGPT وGemini وPerplexity مع دعم اللهجات العربية.'
    : 'Arabic-native GEO analytics for tracking how your brand appears across ChatGPT, Gemini, and Perplexity.';
  const canonical = isArabic ? '/' : '/en';

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ar: '/',
        en: '/en',
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      locale: isArabic ? 'ar_SA' : 'en_US',
      alternateLocale: isArabic ? ['en_US'] : ['ar_SA'],
    },
  };
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
    <div
      lang={locale}
      dir={direction}
      className={cn(fontArabic.variable, fontSans.variable, fontMono.variable)}
    >
      <ClerkProvider
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''}
        appearance={{
          variables: {
            colorPrimary: '#4285f4',
            colorBackground: '#0b0f1f',
            colorText: '#f4f6ff',
          },
        }}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <div
              className={cn(
                'bg-background text-foreground min-h-screen font-sans',
                locale === 'ar' && 'font-arabic',
              )}
            >
              <AnalyticsProvider>{children}</AnalyticsProvider>
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </ClerkProvider>
    </div>
  );
}
