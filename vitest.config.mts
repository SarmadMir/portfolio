import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Reads the @/* alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    // Node by default; a file that needs a DOM opts in with `// @vitest-environment happy-dom`.
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 10_000,
  },
});
