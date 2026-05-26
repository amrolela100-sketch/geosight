export const queueNames = [
  'scan:scheduled',
  'scan:manual',
  'report:generate',
  'alert:send',
  'metrics:daily',
  'dead-letter',
] as const;

export type QueueName = (typeof queueNames)[number];
