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
      `Plugin API config not found at ${path}. Is the OpenKitten bot running?`,
    );
    this.path = path;
  }
}

class RequestError extends Error {
  readonly status: number;
  constructor(status: number, body: string) {
    super(`Plugin API request failed (${status}): ${body}`);
    this.status = status;
  }
}

function createAPIProxyImpl<T extends object>(xdgState?: string): T {
  const stateDir =
    xdgState ??
    Bun.env["XDG_STATE_HOME"] ??
    join(Bun.env["HOME"] ?? "", ".local", "state");
  const configPath = join(stateDir, "openkitten", "plugin-api.json");
  let connection: { url: string; token: string } | undefined;
  let connecting: Promise<{ url: string; token: string }> | undefined;

  async function getConnection(): Promise<{ url: string; token: string }> {
    if (connection) return connection;
    connecting ??= connect();
    return connecting;
  }

  async function connect(): Promise<{ url: string; token: string }> {
    const file = Bun.file(configPath);
    if (!(await file.exists())) {
      throw new ConfigNotFoundError(configPath);
    }
    const json: unknown = await file.json();
    const config = configSchema.parse(json);
    connection = { url: config.url, token: config.token };
    return connection;
  }

  return new Proxy({} as never, {
    get: (_, prop) => {
      if (typeof prop === "symbol" || prop === "then") return undefined;
      return async (...args: unknown[]) => {
        const conn = await getConnection();
        const response = await fetch(conn.url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${conn.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ method: String(prop), args }),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new RequestError(response.status, text);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : undefined;
      };
    },
  }) as T;
}

export const createAPIProxy = Object.assign(createAPIProxyImpl, {
  ConfigNotFoundError,
  RequestError,
});
