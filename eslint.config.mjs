import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    // T6.1: ham console yasağı — loglar merkezi logger'lardan akar
    rules: {
      "no-console": "error",
    },
  },
  {
    files: [
      "src/lib/logger.ts",
      "src/lib/clientLogger.ts",
      "src/**/*.test.ts",
      "scripts/**",
      "fixtures/**",
    ],
    rules: {
      "no-console": "off",
    },
  },
]);
