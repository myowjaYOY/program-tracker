import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      '.vercel/**',
      'public/docs-screens/**',
      'supabase/functions/**',
    ],
  },

  // Disable all ESLint recommended rules
  {
    ...eslint.configs.recommended,
    rules: {},
  },

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      next: {
        rootDir: __dirname, // <-- REQUIRED for Vercel to recognize Next.js
      },
    },
    rules: {
      // Disable all Next.js and React Hooks rules
    },
  },

  // Disable TypeScript ESLint rules
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    rules: {},
  })),
  
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // All TypeScript rules disabled
    },
  },

  prettier,
];