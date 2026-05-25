export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ar';

/** Direction is derived from the locale — Arabic is RTL, English is LTR.
 * Kept on this side rather than fetched from a server because routing
 * decisions (layout dir) need it before render. */
export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
