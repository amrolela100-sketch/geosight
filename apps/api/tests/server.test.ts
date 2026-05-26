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
});
