// ESLint flat config for @scrollpop/dashboard
// Philosophy: genuine bugs are errors; pre-existing style/legacy patterns are warnings,
// so CI stays green while surfacing things to clean up over time.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Ignore build output and tooling
  { ignores: ['dist', 'node_modules', '*.config.js', '*.config.ts', 'vite.config.ts'] },

  // Base JS + TypeScript recommended rules
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // ── React Hooks: real bugs — keep as errors ──────────────────────────────
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Fast-refresh hygiene (Vite) — advisory
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // ── Downgrade common pre-existing patterns to warnings ────────────────────
      // These exist throughout the codebase today; warning keeps CI green while
      // making them visible. Tighten to 'error' incrementally as they're cleaned up.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
      // Deliberate idiom in this codebase: `</\script>` breaks up the literal
      // </script> token in embed-snippet strings so it can't prematurely close a
      // host <script> tag. Warn (don't error) so the defensive escape stays.
      'no-useless-escape': 'warn',

      // ── Genuine correctness rules — keep as errors ───────────────────────────
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
);
