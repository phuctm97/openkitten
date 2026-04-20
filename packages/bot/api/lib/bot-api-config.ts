import { join } from "node:path";
import zod from "zod";

const configSchema = zod.object({
  url: zod.string().min(1),
  token: zod.string().min(1),
});

export async function readBotAPIConfig(): Promise<
  zod.infer<typeof configSchema>
> {
  const stateDir =
    Bun.env["XDG_STATE_HOME"] ?? join(Bun.env["HOME"] ?? "", ".local", "state");
  const configPath = join(stateDir, "openkitten", "bot-api.json");
  const json: unknown = await Bun.file(configPath).json();
  return configSchema.parse(json);
}
