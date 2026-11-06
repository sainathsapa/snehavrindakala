/**
 * SnehaVrinda Kala — ESLint flat config (v9, CJS) for the Medusa backend.
 * TypeScript-aware, non-interactive for CI.
 */

const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: ["dist/", "node_modules/", ".medusa-cache/", "*.medusa-cache/"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
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
