import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    rolldownOptions: { checks: { pluginTimings: false } },
    chunkSizeWarningLimit: 2000,
  },
  server: {
    watch: { ignored: ["**/build/**", "**/coverage/**"] },
    port: 41238,
    strictPort: true,
  },
  plugins: [reactRouter(), tailwindcss()],
});
