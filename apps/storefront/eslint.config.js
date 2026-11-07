/**
 * SnehaVrinda Kala — ESLint flat config (v9) for the Next.js storefront.
 * Non-interactive for CI.
 */
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
    rules: {
      "no-console": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
