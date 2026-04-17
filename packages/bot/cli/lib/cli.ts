import { styleText } from "node:util";
import boxen from "boxen";
import { defineCommand } from "citty";
import { description, version } from "~/package.json" with { type: "json" };

export const cli = defineCommand({
  meta: {
    name: "openkitten",
    version,
    description,
  },
  setup() {
    process.stderr.write(
      `\n${boxen(styleText("bold", "The kitten says hi! 😼"), { padding: 1, borderStyle: "bold" })}\n\n`,
    );
  },
  subCommands: {
    serve: () => import("~/lib/serve").then((m) => m.serve),
    up: () => import("~/lib/up").then((m) => m.up),
    down: () => import("~/lib/down").then((m) => m.down),
  },
});
