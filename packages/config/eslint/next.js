// ESLint flat config for Next.js workspaces. Layered on top of ./base.js.
// Next.js-specific plugins (eslint-config-next, plugin-react-hooks, jsx-a11y)
// are installed inside apps/web — wire them in here when that workspace is scaffolded.

import base from './base.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
];
