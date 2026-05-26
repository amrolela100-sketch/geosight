import { describe, expect, it, vi } from 'vitest';

import { ensureDailyMetricsSchedule } from '../src/metrics/scheduler.js';
import type { QueueRegistry } from '../src/queues/registry.js';

describe('daily metrics scheduler', () => {
  it('skips when queues are disabled', async () => {
    const result = await ensureDailyMetricsSchedule({
      enabled: false,
      names: ['metrics:daily'],
      get: () => null,
      close: async () => undefined,
    } as QueueRegistry);

    expect(result).toEqual({ scheduled: false, reason: 'queues-disabled' });
  });

  it('registers the repeatable daily metrics job', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'job-1' });
    const queue = { add };
    const queues = {
      enabled: true,
      names: ['metrics:daily'],
      get: () => queue,
      close: async () => undefined,
    } as unknown as QueueRegistry;

    const result = await ensureDailyMetricsSchedule(queues);

    expect(result).toMatchObject({
      scheduled: true,
      jobId: 'metrics:daily:utc-02',
      pattern: '0 2 * * *',
    });
    expect(add).toHaveBeenCalledWith(
      'metrics:daily',
      expect.objectContaining({
        retentionDays: 90,
        applyRetention: true,
      }),
      expect.objectContaining({
        jobId: 'metrics:daily:utc-02',
        repeat: {
          pattern: '0 2 * * *',
          tz: 'UTC',
        },
      }),
    );
  });
});
