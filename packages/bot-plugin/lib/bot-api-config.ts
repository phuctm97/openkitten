import { join } from "node:path";
import zod from "zod";

const configSchema = zod.object({
  url: zod.string().min(1),
  token: zod.string().min(1),
});

class ConfigNotFoundError extends Error {
  readonly path: string;
  constructor(path: string) {
    super(
      `Bot API config not found at ${path}. Is the OpenKitten bot running?`,
    );
    this.path = path;
  }
}

async function readBotAPIConfigImpl(
  xdgState?: string,
): Promise<{ url: string; token: string }> {
  const stateDir =
    xdgState ??
    Bun.env["XDG_STATE_HOME"] ??
    join(Bun.env["HOME"] ?? "", ".local", "state");
  const configPath = join(stateDir, "openkitten", "bot-api.json");
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    throw new ConfigNotFoundError(configPath);
  }
  const json: unknown = await file.json();
  return configSchema.parse(json);
}

export const readBotAPIConfig = Object.assign(readBotAPIConfigImpl, {
  ConfigNotFoundError,
});
