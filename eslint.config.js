import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import importPlugin from 'eslint-plugin-import';
import nodePlugin from 'eslint-plugin-node';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import jestPlugin from 'eslint-plugin-jest';
import testingLibraryPlugin from 'eslint-plugin-testing-library';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  // Base configuration for all files
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: true, // Use local tsconfig.json
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      security,
      sonarjs,
      import: importPlugin,
      node: nodePlugin,
      prettier: prettierPlugin,
      jest: jestPlugin,
      'testing-library': testingLibraryPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // Base rules
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,

      // TypeScript rules
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-var-requires': 'error',

      // Security rules (OWASP Top 10)
      'security/detect-object-injection': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'error',
      'security/detect-unsafe-regex': 'error',

      // Code quality rules (SonarJS)
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-duplicate-string': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-useless-catch': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-same-line-conditional': 'error',

      // Import rules
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
        },
      ],
      'import/no-unresolved': 'error',
      'import/no-cycle': 'error',
      'import/no-unused-modules': 'error',

      // Node.js rules (removed due to ESLint v9 compatibility issues)
      // 'node/no-deprecated-api': 'error',
      // 'node/no-extraneous-require': 'error',
      // 'node/no-missing-require': 'error',
      // 'node/no-unpublished-require': 'error',

      // Performance rules
      'no-loop-func': 'error',
      'no-new-func': 'error',
      'prefer-const': 'error',

      // Prettier integration
      'prettier/prettier': 'error',
    },
  },

  // Backend-specific rules (NestJS)
  {
    files: ['apps/auth-service/**/*.{ts,tsx}'],
    rules: {
      // NestJS specific rules
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off', // Common in NestJS DTOs

      // Database and API security
      'sonarjs/sql-queries': 'error',
      'security/detect-sql-injection': 'error',
    },
  },

  // Frontend-specific rules (Next.js)
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      // React/Next.js specific rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Client-side security
      'security/detect-unsafe-regex': 'error',
      'security/detect-eval-with-expression': 'error',
    },
  },

  // Shared packages rules
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      // Strict rules for shared code
      '@typescript-eslint/no-explicit-any': 'error',
      'sonarjs/cognitive-complexity': ['error', 10],
    },
  },

  // Test files rules
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      // Jest rules
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error',

      // Testing Library rules
      'testing-library/await-async-query': 'error',
      'testing-library/no-await-sync-query': 'error',
      'testing-library/no-debugging-utils': 'warn',
      'testing-library/no-dom-import': 'error',
    },
  },

  // Configuration files
  {
    files: ['**/*.config.{js,ts}', '**/config/**/*.{js,ts}'],
    rules: {
      'node/no-unpublished-require': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },

  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/*.generated.ts',
      '**/coverage/**',
      '**/*.d.ts',
    ],
  },
];
