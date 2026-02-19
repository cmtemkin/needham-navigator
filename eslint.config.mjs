// ESLint flat config for Next.js 16 + security scanning
// Uses eslint-plugin-security for OWASP pattern detection

import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import security from "eslint-plugin-security";

export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      ".vercel/**",
      "*.config.js",
      "*.config.mjs",
      "jest.config.ts",
      "tailwind.config.ts",
    ],
  },
  // JavaScript files
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    ...js.configs.recommended,
  },
  // TypeScript files - scripts (more lenient)
  {
    files: ["scripts/**/*.ts", "__tests__/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // TypeScript files - src (stricter + security rules)
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      security,
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // Security plugin rules (restored from legacy .eslintrc.json)
      ...security.configs.recommended.rules,
      // Disable noisy rules that produce excessive false positives
      "security/detect-object-injection": "off", // flags every obj[var] — too noisy
      "security/detect-non-literal-regexp": "off", // flags RSS/scraper XML parsing — safe
      "security/detect-non-literal-fs-filename": "off", // flags known-safe fs.readFile calls
      // Ban Date.now() for ID generation — use crypto.randomUUID() instead
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "TemplateLiteral CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            "Do not use Date.now() in template literals for IDs. Use crypto.randomUUID() instead.",
        },
      ],
    },
  },
  // Config files at root
  {
    files: ["config/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
