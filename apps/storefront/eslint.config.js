/**
 * SnehaVrinda Kala — ESLint flat config (v9) for the Next.js storefront.
 * Non-interactive for CI. TypeScript-aware.
 */
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: [
      ".next/",
      "node_modules/",
      "dist/",
      "build/",
      "public/",
      "*.config.js",
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  }
);
