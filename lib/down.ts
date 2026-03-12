import { defineCommand } from "citty";
import { consola } from "consola";

export const down = defineCommand({
  meta: { description: "Stop and remove OpenKitten from system services." },
  run: async () => {
    consola.log("down");
  },
});
