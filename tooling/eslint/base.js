/// <reference types="./types.d.ts" />

import * as path from "node:path";
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

/**
 * D1 compatibility — flag patterns that use SQL transactions.
 *
 * Cloudflare D1 rejects SQL-level BEGIN / COMMIT / SAVEPOINT statements.
 * Drizzle's `db.transaction()` emits these under the hood, so any call
 * site will crash at runtime on D1.  The Worker patches this out via
 * `createD1Drizzle()`, but new code should avoid `.transaction()` to
 * keep intent clear and prevent surprises after upstream merges.
 *
 * Use `db.batch()` for multi-statement atomicity on D1, or run
 * statements sequentially (D1 is single-writer per request).
 */
export const restrictD1Transactions = tseslint.config({
  files: ["**/*.ts", "**/*.tsx"],
  rules: {
    "no-restricted-syntax": [
      "warn",
      {
        selector: "CallExpression[callee.property.name='transaction']",
        message:
          "D1 rejects SQL BEGIN/COMMIT. The Worker patches .transaction() " +
          "at runtime (see apps/worker/src/d1-drizzle.ts), but prefer " +
          "db.batch() or sequential statements for new code.",
      },
      {
        selector:
          "TemplateLiteral[quasis.0.value.raw=/(?:SET|AND|WHERE|,)\\s+index\\s*[>=<]/]",
        message:
          'Unquoted "index" in raw SQL — "index" is a SQLite reserved ' +
          'keyword. Use "index" (double-quoted) in all raw SQL to avoid ' +
          "D1 syntax errors.",
      },
      {
        selector:
          "TemplateLiteral[quasis.0.value.raw=/SET\\s+index\\s*=/]",
        message:
          'Unquoted "index" in SET clause — "index" is a SQLite reserved ' +
          'keyword. Use SET "index" = ... to avoid D1 syntax errors.',
      },
    ],
  },
});

/**
 * All packages that leverage t3-env should use this rule
 */
export const restrictEnvAccess = tseslint.config(
  { ignores: ["**/env.ts"] },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Use `import { env } from '~/env'` instead to ensure validated types.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          name: "process",
          importNames: ["env"],
          message:
            "Use `import { env } from '~/env'` instead to ensure validated types.",
        },
      ],
    },
  },
);

export default tseslint.config(
  // Ignore files not tracked by VCS and any config files
  includeIgnoreFile(path.join(import.meta.dirname, "../../.gitignore")),
  { ignores: ["**/*.config.*"] },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    plugins: {
      import: importPlugin,
      turbo: turboPlugin,
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      ...turboPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-misused-promises": [
        2,
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        {
          allowConstantLoopConditions: true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
    },
  },
  {
    linterOptions: { reportUnusedDisableDirectives: true },
    languageOptions: { parserOptions: { projectService: true } },
  },
);