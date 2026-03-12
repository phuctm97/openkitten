import { defineCommand } from "citty";
import { consola } from "consola";
import { createExitHook } from "~/lib/create-exit-hook";
import { createOpenCodeProcess } from "~/lib/create-opencode-process";

export const serve = defineCommand({
  meta: { description: "Start the OpenKitten server." },
  run: async () => {
    using exitHook = createExitHook();
    await using opencodeProcess = await createOpenCodeProcess();
    consola.ready("opencode is listening", { port: opencodeProcess.port });
    await Promise.race([exitHook.exited, opencodeProcess.exited]);
  },
});
