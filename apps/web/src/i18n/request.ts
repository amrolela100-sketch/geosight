import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

import { locales, type Locale } from './config.js';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  if (!requested || !locales.includes(requested as Locale)) notFound();

  const locale = requested as Locale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
