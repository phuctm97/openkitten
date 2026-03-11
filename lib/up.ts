import { defineCommand } from "citty";

export default defineCommand({
  meta: { description: "Install and update OpenKitten as a system service." },
  run: async () => {
    console.log("up");
  },
});
