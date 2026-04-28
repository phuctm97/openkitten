import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

const envDir = "../../../..";
const envPrefix = "OPENKITTEN_";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, envPrefix);
  return {
    envDir,
    envPrefix,
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
    define: {
      "process.env.OPENKITTEN_LOCAL": JSON.stringify(
        env.OPENKITTEN_LOCAL ?? "",
      ),
      "process.env.OPENKITTEN_MAGIC_LINK_ENABLED": JSON.stringify(
        env.OPENKITTEN_MAGIC_LINK_ENABLED ?? "",
      ),
      "process.env.OPENKITTEN_PASSKEY_ENABLED": JSON.stringify(
        env.OPENKITTEN_PASSKEY_ENABLED ?? "",
      ),
    },
    plugins: [reactRouter(), tailwindcss()],
  };
});
