import type { JobsOptions, Queue } from 'bullmq';

import type { QueueRegistry } from '../queues/registry.js';

const DAILY_JOB_ID = 'metrics:daily:utc-02';
const DAILY_CRON = '0 2 * * *';

export async function ensureDailyMetricsSchedule(
  queues: QueueRegistry,
  options: {
    queue?: Queue | null;
    retentionDays?: number;
    applyRetention?: boolean;
  } = {},
): Promise<{ scheduled: boolean; jobId?: string; pattern?: string; reason?: string }> {
  if (!queues.enabled) return { scheduled: false, reason: 'queues-disabled' };

  const queue = options.queue ?? queues.get('metrics:daily');
  if (!queue) return { scheduled: false, reason: 'queue-missing' };

  const repeat: JobsOptions['repeat'] = {
    pattern: DAILY_CRON,
    tz: 'UTC',
  };

  await queue.add(
    'metrics:daily',
    {
      retentionDays: options.retentionDays ?? 90,
      applyRetention: options.applyRetention ?? true,
      requestedAt: new Date().toISOString(),
    },
    {
      jobId: DAILY_JOB_ID,
      repeat,
    },
  );

  return { scheduled: true, jobId: DAILY_JOB_ID, pattern: DAILY_CRON };
}
