'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

/** PostHog browser init, gated on NEXT_PUBLIC_POSTHOG_KEY.
 *
 * Mounted once at the locale layout. Runs after hydration so it never blocks
 * paint. If the key isn't set, this is a no-op — no provider script loaded.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      capture_pageview: 'history_change',
      autocapture: false,
      person_profiles: 'identified_only',
    });
  }, []);

  return <>{children}</>;
}
