import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: { chunkSizeWarningLimit: 2000 },
  server: { watch: { ignored: ["**/build/**", "**/coverage/**"] } },
  plugins: [reactRouter(), tailwindcss()],
});
