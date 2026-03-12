import { defineCommand } from "citty";
import { consola } from "consola";

export default defineCommand({
  meta: { description: "Install and update OpenKitten as a system service." },
  run: async () => {
    consola.log("up");
  },
});
