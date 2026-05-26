import './globals.css';

import type { Metadata, Viewport } from 'next';

const appUrl = new URL(process.env.APP_URL ?? 'http://localhost:3000');
const defaultDescription =
  'تتبّع كيف تظهر علامتك التجارية في إجابات ChatGPT وGemini وPerplexity — بدقة عربية أصلية تتعامل مع كل اللهجات.';

/** Root layout — language-neutral. The `[locale]` segment is responsible for
 * setting `lang` and `dir` on the <html> element, but the boilerplate root
 * is needed so Next.js can hydrate without a locale (e.g. on `/sign-in`). */

export const metadata: Metadata = {
  metadataBase: appUrl,
  title: {
    default: 'GeoSight — ظهور علامتك في عصر الذكاء الاصطناعي',
    template: '%s · GeoSight',
  },
  description: defaultDescription,
  applicationName: 'GeoSight',
  authors: [{ name: 'GeoSight' }],
  creator: 'GeoSight',
  publisher: 'GeoSight',
  category: 'Marketing Analytics',
  keywords: [
    'GEO',
    'Generative Engine Optimization',
    'ChatGPT',
    'Gemini',
    'Perplexity',
    'تحسين محركات البحث',
    'العربية',
  ],
  alternates: {
    canonical: '/',
    languages: {
      ar: '/',
      en: '/en',
    },
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'GeoSight — ظهور علامتك في عصر الذكاء الاصطناعي',
    description: defaultDescription,
    locale: 'ar_SA',
    alternateLocale: ['en_US'],
    siteName: 'GeoSight',
    images: [
      {
        url: '/ads/geosight-og-ad.png',
        width: 1200,
        height: 630,
        alt: 'GeoSight GEO analytics dashboard preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GeoSight — Arabic-native GEO analytics',
    description: defaultDescription,
    images: ['/ads/geosight-og-ad.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfc' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
