import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // `scripts/` holds Node verification scripts, not application code. Two of
  // them deliberately imitate React — `react-memo-stub.mjs` reimplements
  // `useMemo`/`useCallback` so a hook's memoization can be measured outside a
  // renderer, and `verify-order-search.mjs` calls that hook from a plain
  // function on purpose. The React rules read both as broken components. They
  // are not components at all, and there is no React in this directory to
  // protect.
  {
    files: ["scripts/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
