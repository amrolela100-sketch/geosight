import base from '@geosight/config/eslint/base';
import globals from 'globals';

export default [
  ...base,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
