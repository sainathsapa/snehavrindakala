/**
 * SnehaVrinda Kala — ESLint flat config (v9) for the Next.js storefront.
 * Non-interactive for CI.
 *
 * The previous version matched TypeScript files but never set a parser, so
 * ESLint fell back to Espree and reported "Parsing error: Unexpected token
 * interface" on every TypeScript file in the app. The TypeScript parser is
 * available through eslint-config-next, so the config just has to ask for it.
 */

const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const nextPlugin = require("@next/eslint-plugin-next");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = [
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
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "no-console": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];
