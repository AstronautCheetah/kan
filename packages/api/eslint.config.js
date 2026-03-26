import baseConfig, { restrictD1Transactions } from "@kan/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**"],
  },
  ...baseConfig,
  ...restrictD1Transactions,
];
