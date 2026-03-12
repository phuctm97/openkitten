import { defineCommand } from "citty";
import { consola } from "consola";

export const up = defineCommand({
  meta: { description: "Install and update OpenKitten as a system service." },
  run: async () => {
    consola.log("up");
  },
});
