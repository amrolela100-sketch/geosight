import { describe, expect, it, vi } from 'vitest';

import type { QueueRegistry } from '../src/queues/registry.js';
import { ensureVaultValidationSchedule } from '../src/vault/scheduler.js';

describe('vault validation scheduler', () => {
  it('skips when queues are disabled', async () => {
    const result = await ensureVaultValidationSchedule({
      enabled: false,
      names: ['vault:validate'],
      get: () => null,
      close: async () => undefined,
    } as QueueRegistry);

    expect(result).toEqual({ scheduled: false, reason: 'queues-disabled' });
  });

  it('registers the repeatable vault validation job', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'job-1' });
    const queue = { add };
    const queues = {
      enabled: true,
      names: ['vault:validate'],
      get: () => queue,
      close: async () => undefined,
    } as unknown as QueueRegistry;

    const result = await ensureVaultValidationSchedule(queues);

    expect(result).toMatchObject({
      scheduled: true,
      jobId: 'vault:validate:daily:utc-03',
      pattern: '0 3 * * *',
    });
    expect(add).toHaveBeenCalledWith(
      'vault:validate',
      expect.objectContaining({
        enqueueAlerts: true,
      }),
      expect.objectContaining({
        jobId: 'vault:validate:daily:utc-03',
        repeat: {
          pattern: '0 3 * * *',
          tz: 'UTC',
        },
      }),
    );
  });
});
