/** Next.js instrumentation hook — runs once when the runtime boots. Required
 * for Sentry App Router integration (8.x and later).
 *
 * Each runtime imports the matching sentry.*.config.ts which is itself a
 * no-op if no DSN is configured. So this hook is safe to ship even when
 * Sentry isn't wired up yet.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
