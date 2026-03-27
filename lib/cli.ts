import { styleText } from "node:util";
import boxen from "boxen";
import { defineCommand } from "citty";
import { down } from "~/lib/down";
import { serve } from "~/lib/serve";
import { up } from "~/lib/up";
import pkg from "~/package.json" with { type: "json" };

export const cli = defineCommand({
  meta: {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
  },
  setup() {
    process.stderr.write(
      `\n${boxen(styleText("bold", "The kitten says hi! 😼"), { padding: 1, borderStyle: "bold" })}\n\n`,
    );
  },
  subCommands: {
    serve,
    up,
    down,
  },
});
