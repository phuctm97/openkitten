import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { styleText } from "node:util";
import boxen from "boxen";
import { Errors } from "~/lib/errors";
import { isTTY } from "~/lib/is-tty";
import type { Profile } from "~/lib/profile";
import pkg from "~/package.json" with { type: "json" };

const bin = resolve(import.meta.dirname, "../node_modules/.bin/opencode");

const defaultAgentsDir = resolve(import.meta.dirname, "../agents");

const defaultConfigJson = {
  $schema: "https://opencode.ai/config.json",
  default_agent: "assist",
};

export interface OpencodeConfig {
  readonly bin: string;
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
  readonly authorization: string;
}

export namespace OpencodeConfig {
  export async function create(profile: Profile): Promise<OpencodeConfig> {
    const writes: Promise<unknown>[] = [];
    const configDir = join(profile.dir, ".opencode");
    const agentsDir = join(configDir, "agents");
    await mkdir(agentsDir, { recursive: true });
    const agentsGlob = new Bun.Glob("*.md");
    for await (const file of agentsGlob.scan(defaultAgentsDir)) {
      writes.push(
        copyFile(
          join(defaultAgentsDir, file),
          join(agentsDir, file),
          constants.COPYFILE_EXCL,
        ),
      );
    }
    writes.push(
      writeFile(
        join(configDir, "opencode.json"),
        JSON.stringify(defaultConfigJson, null, 2),
        { flag: "wx" },
      ),
    );
    const results = await Promise.allSettled(writes);
    const errors = results
      .filter(
        (r): r is PromiseRejectedResult =>
          r.status === "rejected" && r.reason?.code !== "EEXIST",
      )
      .map((r) => r.reason);
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new Errors(...errors);
    const username = pkg.name;
    const password = randomBytes(32).toString("base64url");
    const config: OpencodeConfig = {
      bin,
      cwd: profile.workspace,
      env: {
        HOME: Bun.env["HOME"],
        PATH: Bun.env["PATH"],
        NODE_ENV: Bun.env["NODE_ENV"],
        XDG_DATA_HOME: profile.xdgData,
        XDG_CONFIG_HOME: profile.xdgConfig,
        XDG_STATE_HOME: profile.xdgState,
        XDG_CACHE_HOME: profile.xdgCache,
        OPENCODE_CONFIG_DIR: configDir,
        OPENCODE_CONFIG_CONTENT: JSON.stringify({
          autoupdate: false,
          share: "disabled",
          server: {
            mdns: false,
            mdnsDomain: "opencode.local",
            cors: ["https://opencode.local"],
          },
        }),
        OPENCODE_SERVER_USERNAME: username,
        OPENCODE_SERVER_PASSWORD: password,
        OPENCODE_DISABLE_AUTOUPDATE: "true",
        OPENCODE_DISABLE_TERMINAL_TITLE: "true",
        OPENCODE_ENABLE_EXA: "true",
        OPENCODE_ENABLE_EXPERIMENTAL_MODELS: "true",
      },
      authorization: `Basic ${btoa(`${username}:${password}`)}`,
    };
    if (isTTY) {
      const quiet = Bun.spawn([bin, "providers", "list"], {
        cwd: config.cwd,
        env: config.env,
        stdio: ["ignore", "ignore", "ignore"],
      });
      await quiet.exited;
      process.stderr.write(
        boxen(styleText("bold", "OpenCode"), { padding: 1 }),
      );
      const interactive = Bun.spawn([bin, "providers", "list"], {
        cwd: config.cwd,
        env: config.env,
        stdio: ["inherit", "inherit", "inherit"],
      });
      await interactive.exited;
    }
    return config;
  }
}
