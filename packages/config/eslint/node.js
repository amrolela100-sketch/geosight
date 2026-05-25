// ESLint flat config for Node.js services (Fastify api, BullMQ workers, scripts).
// Server code may legitimately log to stdout via pino — relax `no-console`.

import base from './base.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    files: ['**/*.{ts,js,mts,cts}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
