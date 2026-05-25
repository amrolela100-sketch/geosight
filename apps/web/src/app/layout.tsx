import './globals.css';

import type { Metadata, Viewport } from 'next';

/** Root layout — language-neutral. The `[locale]` segment is responsible for
 * setting `lang` and `dir` on the <html> element, but the boilerplate root
 * is needed so Next.js can hydrate without a locale (e.g. on `/sign-in`). */

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'GeoSight — ظهور علامتك في عصر الذكاء الاصطناعي',
    template: '%s · GeoSight',
  },
  description:
    'تتبّع كيف تظهر علامتك التجارية في إجابات ChatGPT وGemini وPerplexity — بدقة عربية أصلية تتعامل مع كل اللهجات.',
  applicationName: 'GeoSight',
  authors: [{ name: 'GeoSight' }],
  keywords: [
    'GEO',
    'Generative Engine Optimization',
    'ChatGPT',
    'Gemini',
    'Perplexity',
    'تحسين محركات البحث',
    'العربية',
  ],
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    siteName: 'GeoSight',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfc' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
