import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Flat ESLint config. Kept lean: recommended TS rules + no-unused-vars for
 * types. React/Next correctness is enforced by tests and tsc; the hook rules
 * plugin can be enabled once the demo app lives in this repo.
 */
export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },
  {
    files: ["benchmarks/**/*", "scripts/**/*"],
    languageOptions: { globals: { ...globals.node } },
  },
);
