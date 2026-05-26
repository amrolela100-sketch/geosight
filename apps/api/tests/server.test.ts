import { describe, expect, it } from 'vitest';

import type { QueueRegistry } from '../src/queues/registry.js';
import { buildServer } from '../src/server.js';

function createDisabledQueues(): QueueRegistry {
  return {
    enabled: false,
    names: ['scan:scheduled', 'scan:manual', 'report:generate', 'alert:send', 'dead-letter'],
    get: () => null,
    close: async () => undefined,
  };
}

describe('@geosight/api server', () => {
  it('serves health status', async () => {
    const app = await buildServer({ logger: false, queues: createDisabledQueues() });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      service: '@geosight/api',
      queues: {
        enabled: false,
      },
    });

    await app.close();
  });

  it('returns 503 when queues are not configured', async () => {
    const app = await buildServer({ logger: false, queues: createDisabledQueues() });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/queues/scan:manual/jobs',
      payload: {
        organizationId: '02b048c0-bc91-4c9f-8f39-261586d6e0b2',
        brandId: 'cf2d372c-9d88-4f7e-a432-c0a702f4f911',
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'QueuesUnavailable' });

    await app.close();
  });

  it('exposes the friendly /v1/scans/trigger alias', async () => {
    const app = await buildServer({ logger: false, queues: createDisabledQueues() });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/scans/trigger',
      payload: {
        organizationId: '02b048c0-bc91-4c9f-8f39-261586d6e0b2',
        brandId: 'cf2d372c-9d88-4f7e-a432-c0a702f4f911',
      },
    });

    // Queues are disabled in the test so we expect the same 503 envelope,
    // but the route should exist (would 404 otherwise).
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'QueuesUnavailable' });

    await app.close();
  });

  it('rejects invalid scan trigger payloads with 400', async () => {
    // Stub `enabled: true` so the route reaches the payload validator. The
    // queue lookup will still fail safely since `get` returns null.
    const queues: QueueRegistry = {
      enabled: true,
      names: ['scan:scheduled', 'scan:manual', 'report:generate', 'alert:send', 'dead-letter'],
      get: () => null,
      close: async () => undefined,
    };
    const app = await buildServer({ logger: false, queues });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/scans/trigger',
      payload: { organizationId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'InvalidPayload' });

    await app.close();
  });
});
