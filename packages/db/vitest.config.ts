import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

const here = dirname(fileURLToPath(import.meta.url));

// Match the migrate runner: load .env from the monorepo root, then fall back
// to a local .env file if present. Tests need DATABASE_URL_UNPOOLED.
loadEnv({ path: resolve(here, '../../.env') });
loadEnv();

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // postgres-js holds open TCP sockets — forks isolates per-suite without
    // worker reuse fighting the connection lifecycle.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
