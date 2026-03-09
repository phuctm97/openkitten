import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["tsconfig.json"] })],
  test: {
    coverage: {
      include: ["lib/**/*.{ts,tsx}"],
      exclude: ["lib/git.ts", "lib/main.ts"],
      reporter: ["text", "html"],
      provider: "istanbul",
    },
    include: ["test/**/*.test.{ts,tsx}"],
    exclude: ["test/git.test.ts"],
    setupFiles: ["test/setup.ts"],
    clearMocks: true,
    unstubGlobals: true,
  },
});
