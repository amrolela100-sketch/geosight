import type { LoggerOptions } from 'pino';

/** Pino config that's pretty in dev (color, timestamps) and JSON in
 * production. Test mode disables logging entirely so vitest output stays
 * readable. Sensitive headers are redacted so we don't paint API tokens
 * across stdout. */
export function buildLoggerOptions(nodeEnv: string): LoggerOptions | boolean {
  if (nodeEnv === 'test') return false;

  const base: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? (nodeEnv === 'production' ? 'info' : 'debug'),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-token"]',
        'req.headers["x-clerk-auth"]',
      ],
      remove: true,
    },
    serializers: {
      req(req: { method: string; url: string; headers: Record<string, string> }) {
        return {
          method: req.method,
          url: req.url,
          // Drop the headers blob — we keep only the fields we genuinely need.
          host: req.headers.host,
          userAgent: req.headers['user-agent'],
        };
      },
      res(res: { statusCode: number }) {
        return { statusCode: res.statusCode };
      },
    },
  };

  if (nodeEnv === 'production') {
    return base;
  }

  return {
    ...base,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  };
}
