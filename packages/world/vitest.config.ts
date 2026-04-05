import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["tsconfig.json"] })],
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
    coverage: {
      provider: "istanbul",
      include: [
        "app/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
      ],
      exclude: ["app/routes.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
