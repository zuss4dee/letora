/**
 * Deterministic Vitest preset (CSV/rent KPIs/onboarding parsers/CEO routing stubs, etc.).
 * Does not evaluate live LLMs — onboarding LLM helpers use dynamic imports so this graph stays key-free.
 * For optional live checks, use vitest.integration.config.mts (`pnpm run test:integrations`).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    /** Exclude explicitly named integration tests (see vitest.integration.config.mts). */
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.join(dir, "src"),
    },
  },
});
