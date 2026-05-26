import { env } from './env.js';
import { buildServer } from './server.js';

const app = await buildServer();

try {
  await app.listen({
    host: env.API_HOST,
    port: env.API_PORT,
  });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
