/**
 * SnehaVrinda Kala — shared ESLint flat base config (v9, CJS).
 * Consumed by apps/backend/eslint.config.js.
 */

const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: ["node_modules/", "dist/", ".next/", "build/", "*.config.js"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      ecmaVersion: 2022,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-console": "warn",
    },
  }
);
