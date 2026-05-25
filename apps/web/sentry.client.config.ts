/** Sentry browser SDK init — gated on NEXT_PUBLIC_SENTRY_DSN.
 *
 * BYOK posture: the project owner doesn't pay for telemetry. If the customer
 * deployment doesn't set a DSN, Sentry is a no-op.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NODE_ENV,
  });
}
