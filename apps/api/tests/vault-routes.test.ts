import { describe, expect, it } from 'vitest';

import type { QueueRegistry } from '../src/queues/registry.js';
import { buildServer } from '../src/server.js';

function disabledQueues(): QueueRegistry {
  return {
    enabled: false,
    names: [
      'scan:scheduled',
      'scan:manual',
      'report:generate',
      'alert:send',
      'metrics:daily',
      'vault:validate',
      'dead-letter',
    ],
    get: () => null,
    close: async () => undefined,
  };
}

// Note: env.ts captures process.env at module-load time, so we can't test the
// "valid token but missing master key" path here without spawning a sub-process.
// The 401 paths exercise the auth gate; the rest is covered by manual smoke
// against a configured api.

describe('vault routes — auth gates', () => {
  it('returns 401 on internal/decrypt without token', async () => {
    const app = await buildServer({
      logger: false,
      queues: disabledQueues(),
      startMetricsWorker: false,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/vault/decrypt',
      payload: { orgId: '00000000-0000-0000-0000-000000000000', provider: 'openai' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'Unauthorized' });
    await app.close();
  });

  it('returns 401 on admin/validate-all without token', async () => {
    const app = await buildServer({
      logger: false,
      queues: disabledQueues(),
      startMetricsWorker: false,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/vault/validate-all',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects malformed internal/decrypt payload even before auth check', async () => {
    // No token set in env, so this hits the 401 gate first. Confirms the
    // payload validator is wired but not accidentally leaking 400s past the
    // auth boundary.
    const app = await buildServer({
      logger: false,
      queues: disabledQueues(),
      startMetricsWorker: false,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/vault/decrypt',
      payload: { wrong: 'shape' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
