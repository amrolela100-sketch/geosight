export const queueNames = [
  'scan:scheduled',
  'scan:manual',
  'report:generate',
  'alert:send',
  'metrics:daily',
  'vault:validate',
  'dead-letter',
] as const;

export type QueueName = (typeof queueNames)[number];
