import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { queueNames, type QueueName } from '../queues/names.js';
import {
  alertJobSchema,
  dailyMetricsJobSchema,
  reportJobSchema,
  scanJobSchema,
  type AlertJobPayload,
  type DailyMetricsJobPayload,
  type ReportJobPayload,
  type ScanJobPayload,
} from '../queues/payloads.js';
import type { QueueRegistry } from '../queues/registry.js';

type QueueRoutesOptions = {
  queues: QueueRegistry;
};

type JobPayload =
  | ScanJobPayload
  | ReportJobPayload
  | AlertJobPayload
  | DailyMetricsJobPayload
  | {
      failedQueue: QueueName;
      failedJobId?: string;
      reason: string;
      payload?: unknown;
    };

const enqueueParamsSchema = z.object({
  name: z.enum(queueNames),
});

function schemaForQueue(name: QueueName) {
  if (name === 'scan:scheduled' || name === 'scan:manual') return scanJobSchema;
  if (name === 'report:generate') return reportJobSchema;
  if (name === 'alert:send') return alertJobSchema;
  if (name === 'metrics:daily') return dailyMetricsJobSchema;
  return z.object({
    failedQueue: z.enum(queueNames),
    failedJobId: z.string().min(1).optional(),
    reason: z.string().min(1),
    payload: z.unknown().optional(),
  });
}

export const queueRoutes: FastifyPluginAsync<QueueRoutesOptions> = async (app, options) => {
  app.get('/queues', async () => ({
    enabled: options.queues.enabled,
    queues: options.queues.names.map((name) => ({ name })),
  }));

  app.post('/queues/:name/jobs', async (req, reply) => {
    const params = enqueueParamsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(404).send({ error: 'QueueNotFound' });
    }

    if (!options.queues.enabled) {
      return reply.code(503).send({ error: 'QueuesUnavailable' });
    }

    const payload = schemaForQueue(params.data.name).safeParse(req.body);
    if (!payload.success) {
      return reply.code(400).send({
        error: 'InvalidPayload',
        issues: payload.error.issues,
      });
    }

    const queue = options.queues.get(params.data.name);
    if (!queue) return reply.code(404).send({ error: 'QueueNotFound' });

    const job = await queue.add(params.data.name, payload.data as JobPayload);

    return reply.code(202).send({
      ok: true,
      queue: params.data.name,
      jobId: job.id,
    });
  });
};
