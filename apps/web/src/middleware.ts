import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';

import { defaultLocale, locales } from './i18n/config.js';

const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'as-needed',
});

const isProtectedRoute = createRouteMatcher([
  '/(ar|en)/dashboard(.*)',
  '/dashboard(.*)',
  '/(ar|en)/settings(.*)',
  '/settings(.*)',
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (isProtectedRoute(req)) {
    const session = await auth();
    if (!session.userId) {
      const locale = req.nextUrl.pathname.split('/')[1];
      const prefix = locales.includes(locale as (typeof locales)[number]) ? `/${locale}` : '';
      return NextResponse.redirect(new URL(`${prefix}/sign-in`, req.url));
    }
  }
  return intlMiddleware(req);
});

export const config = {
  // Match every route except Next.js internals and static assets.
  matcher: ['/((?!_next|api/health|.*\\..*).*)'],
};
