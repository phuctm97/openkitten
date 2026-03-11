import { defineCommand } from "citty";
import down from "~/lib/down";
import serve from "~/lib/serve";
import up from "~/lib/up";
import pkg from "~/package.json" with { type: "json" };

export default defineCommand({
  meta: {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
  },
  subCommands: {
    serve,
    up,
    down,
  },
});
