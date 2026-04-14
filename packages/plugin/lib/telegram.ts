import { join } from "node:path";
import { Api } from "grammy";
import zod from "zod";

const botTokenPattern = /^\d+:[A-Za-z0-9_-]{35}$/;

const configSchema = zod.object({
  botToken: zod.string().regex(botTokenPattern),
  userId: zod.int().positive(),
});

export namespace Telegram {
  export type Config = zod.output<typeof configSchema>;

  export class ConfigNotFoundError extends Error {
    readonly path: string;
    constructor(path: string) {
      super(`Telegram config not found at ${path}`);
      this.path = path;
    }
  }

  export function resolveConfigDir(xdgConfig?: string): string {
    return (
      xdgConfig ??
      Bun.env["XDG_CONFIG_HOME"] ??
      join(Bun.env["HOME"] ?? "", ".config")
    );
  }

  export async function readConfig(xdgConfig?: string): Promise<Config> {
    const configDir = resolveConfigDir(xdgConfig);
    const configPath = join(configDir, "openkitten", "telegram.json");
    const file = Bun.file(configPath);
    if (!(await file.exists())) {
      throw new Telegram.ConfigNotFoundError(configPath);
    }
    const json: unknown = await file.json();
    return configSchema.parse(json);
  }

  export async function getToken(xdgConfig?: string): Promise<string> {
    const config = await readConfig(xdgConfig);
    return config.botToken;
  }

  export async function createApi(xdgConfig?: string): Promise<Api> {
    const token = await getToken(xdgConfig);
    return new Api(token);
  }
}
