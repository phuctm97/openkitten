import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      include: ["lib/**/*.{ts,tsx}"],
      exclude: ["lib/main.ts"],
    },
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
    clearMocks: true,
  },
});
