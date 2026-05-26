import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { scanJobSchema } from '../queues/payloads.js';
import type { QueueRegistry } from '../queues/registry.js';

type ScanRoutesOptions = {
  queues: QueueRegistry;
};

const triggerBodySchema = scanJobSchema;

const statusParamsSchema = z.object({
  jobId: z.string().min(1),
});

const statusQuerySchema = z.object({
  /** Override the default queue (scan:manual) — used by ops to chase down a
   * job that was enqueued through scan:scheduled or moved to dead-letter. */
  queue: z.enum(['scan:scheduled', 'scan:manual', 'dead-letter']).default('scan:manual'),
});

export const scanRoutes: FastifyPluginAsync<ScanRoutesOptions> = async (app, options) => {
  /** Higher-level wrapper over POST /v1/queues/scan:manual/jobs. Same payload,
   * but reads better as a top-level "trigger a scan" verb in the public API. */
  app.post('/scans/trigger', async (req, reply) => {
    if (!options.queues.enabled) {
      return reply.code(503).send({ error: 'QueuesUnavailable' });
    }

    const parsed = triggerBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'InvalidPayload',
        issues: parsed.error.issues,
      });
    }

    const queue = options.queues.get('scan:manual');
    if (!queue) return reply.code(503).send({ error: 'QueuesUnavailable' });

    const job = await queue.add('scan:manual', parsed.data);

    return reply.code(202).send({
      ok: true,
      jobId: job.id,
      queue: 'scan:manual',
    });
  });

  /** Read job status — used by the dashboard to poll for scan completion. */
  app.get('/scans/:jobId/status', async (req, reply) => {
    if (!options.queues.enabled) {
      return reply.code(503).send({ error: 'QueuesUnavailable' });
    }

    const params = statusParamsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'InvalidJobId' });
    }
    const query = statusQuerySchema.safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: 'InvalidQuery' });
    }

    const queue = options.queues.get(query.data.queue);
    if (!queue) return reply.code(404).send({ error: 'QueueNotFound' });

    const job = await queue.getJob(params.data.jobId);
    if (!job) return reply.code(404).send({ error: 'JobNotFound' });

    const state = await job.getState();
    return reply.send({
      ok: true,
      jobId: job.id,
      queue: query.data.queue,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
      finishedOn: job.finishedOn ?? null,
      processedOn: job.processedOn ?? null,
    });
  });
};
