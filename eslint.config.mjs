import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This codebase's established client-fetch convention (useEffect +
      // fetch + setState, used consistently across every paginated screen
      // since Phase 1) trips this rule everywhere by design. Downgraded
      // rather than silenced so it still surfaces during review.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Standalone Node helper scripts at the repo root are plain CommonJS.
  {
    files: ["*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Demo repositories are standalone Java/Python/Go/C/Terraform fixtures
    // with their own toolchains — not part of this Next.js app.
    "demo-repos/**",
  ]),
]);

export default eslintConfig;
