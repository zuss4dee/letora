/**
 * Optional LLM / live-service integration tests only.
 *
 * Name files `*.integration.test.ts` and run `pnpm run test:integrations`.
 * Default `pnpm test` uses vitest.config.mts and MUST stay green without API keys.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.join(dir, "src"),
    },
  },
});
