import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Reads the @/* alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 10_000,
  },
});
