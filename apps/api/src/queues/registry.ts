import { Queue, type JobsOptions, type QueueOptions } from 'bullmq';
import IORedis from 'ioredis';

import { env } from '../env.js';

import { queueNames, type QueueName } from './names.js';

export type QueueRegistry = {
  enabled: boolean;
  names: readonly QueueName[];
  get(name: QueueName): Queue | null;
  close(): Promise<void>;
};

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2_000,
  },
  removeOnComplete: {
    age: 60 * 60 * 24 * 7,
    count: 1_000,
  },
  removeOnFail: {
    age: 60 * 60 * 24 * 30,
  },
};

export function createQueueRegistry(redisUrl = env.REDIS_URL): QueueRegistry {
  if (!redisUrl) {
    return {
      enabled: false,
      names: queueNames,
      get: () => null,
      close: async () => undefined,
    };
  }

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const queueOptions: QueueOptions = {
    connection,
    defaultJobOptions,
  };

  const queues = new Map<QueueName, Queue>(
    queueNames.map((name) => [name, new Queue(name, queueOptions)]),
  );

  return {
    enabled: true,
    names: queueNames,
    get: (name) => queues.get(name) ?? null,
    async close() {
      await Promise.all([...queues.values()].map((queue) => queue.close()));
      connection.disconnect();
    },
  };
}
