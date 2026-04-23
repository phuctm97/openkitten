import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { styleText } from "node:util";
import * as clack from "@clack/prompts";
import boxen from "boxen";
import { Errors } from "~/lib/errors";
import { isTTY } from "~/lib/is-tty";
import type { Profile } from "~/lib/profile";

const bin = resolve(import.meta.dirname, "../node_modules/.bin/opencode");

const defaultAgentsDir = resolve(import.meta.dirname, "../agents");

const defaultCommandsDir = resolve(import.meta.dirname, "../commands");

const defaultSkillsDir = resolve(import.meta.dirname, "../skills");

const systemAgents = resolve(import.meta.dirname, "../system-agents.md");

const defaultPrompt = resolve(import.meta.dirname, "../default-prompt.md");

const agentFilePathPlaceholder = "__OPENKITTEN_AGENT_FILE_PATH__";
const agentFilePathYamlPlaceholder = "__OPENKITTEN_AGENT_FILE_PATH_YAML__";

const defaultConfigJson = {
  $schema: "https://opencode.ai/config.json",
  default_agent: "assist",
};

const opencodePluginFilename = "openkitten.js";

const opencodePluginSource = `export default {
  id: "openkitten-metadata",
  server: async () => ({
    "tool.execute.before": async ({ tool, sessionID, callID }, { args }) => {
      if (!tool.startsWith("openkitten_")) return;
      if (typeof args !== "object" || args === null) return;
      args.__OPENKITTEN__ = { sessionID, callID };
    },
  }),
};
`;

interface OpencodeConfigCreateOptions {
  readonly skipActions?: boolean | undefined;
}

function normalizePathPattern(path: string): string {
  return path.replaceAll("\\", "/");
}

function renderAgentTemplate(template: string, agentPath: string): string {
  const normalizedAgentPath = normalizePathPattern(agentPath);
  return template
    .replaceAll(agentFilePathPlaceholder, normalizedAgentPath)
    .replaceAll(
      agentFilePathYamlPlaceholder,
      JSON.stringify(normalizedAgentPath),
    );
}

async function writeDefaultAgentFile(
  source: string,
  destination: string,
): Promise<void> {
  const template = await readFile(source, "utf-8");
  const rendered = renderAgentTemplate(template, destination);
  await writeFile(destination, rendered, { flag: "wx" });
}

function cancel(): never {
  clack.cancel("Cancelled");
  throw new OpencodeConfig.CancelledError();
}

export interface OpencodeConfig {
  readonly bin: string;
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
  readonly authorization: string;
}

export namespace OpencodeConfig {
  export class CancelledError extends Error {
    constructor() {
      super("OpenCode config is cancelled");
    }
  }

  export async function create(
    profile: Profile,
    options: OpencodeConfigCreateOptions = {},
  ): Promise<OpencodeConfig> {
    const writes: Array<() => Promise<unknown>> = [];
    const configDir = join(profile.dir, ".opencode");
    const agentsDir = join(configDir, "agents");
    const commandsDir = join(configDir, "commands");
    const skillsDir = join(configDir, "skills");
    const agentSkillsDir = join(configDir, ".agents", "skills");
    const projectPluginsDir = join(configDir, "plugins");
    const xdgCommandsDir = join(profile.xdgConfigOpencode, "commands");
    await Promise.all([
      mkdir(agentsDir, { recursive: true }),
      mkdir(commandsDir, { recursive: true }),
      mkdir(skillsDir, { recursive: true }),
      mkdir(agentSkillsDir, { recursive: true }),
      mkdir(projectPluginsDir, { recursive: true }),
      mkdir(profile.workspace, { recursive: true }),
      mkdir(profile.xdgConfigSkill, { recursive: true }),
      mkdir(xdgCommandsDir, { recursive: true }),
    ]);
    const mdGlob = new Bun.Glob("*.md");
    const agentFiles: string[] = [];
    for await (const file of mdGlob.scan(defaultAgentsDir)) {
      agentFiles.push(file);
    }
    for (const file of agentFiles) {
      const source = join(defaultAgentsDir, file);
      const destination = join(agentsDir, file);
      writes.push(() => writeDefaultAgentFile(source, destination));
    }
    const commandFiles: string[] = [];
    for await (const file of mdGlob.scan(defaultCommandsDir)) {
      commandFiles.push(file);
    }
    for (const file of commandFiles) {
      const source = join(defaultCommandsDir, file);
      const destination = join(xdgCommandsDir, file);
      writes.push(async () => {
        const content = await readFile(source, "utf-8");
        await writeFile(destination, content);
      });
    }
    const skillGlob = new Bun.Glob("*/**");
    const skillFiles: string[] = [];
    for await (const file of skillGlob.scan(defaultSkillsDir)) {
      skillFiles.push(file);
    }
    for (const file of skillFiles) {
      const source = join(defaultSkillsDir, file);
      const destination = join(profile.xdgConfigSkill, file);
      writes.push(() =>
        mkdir(dirname(destination), { recursive: true }).then(async () => {
          const content = await readFile(source, "utf-8");
          await writeFile(destination, content);
        }),
      );
    }
    writes.push(() =>
      readFile(defaultPrompt, "utf-8").then((content) =>
        writeFile(join(configDir, "AGENTS.md"), content, { flag: "wx" }),
      ),
    );
    writes.push(() =>
      readFile(systemAgents, "utf-8").then((content) =>
        writeFile(join(profile.xdgConfigOpencode, "AGENTS.md"), content),
      ),
    );
    writes.push(() =>
      writeFile(
        join(configDir, "opencode.json"),
        JSON.stringify(defaultConfigJson, null, 2),
        { flag: "wx" },
      ),
    );
    writes.push(() =>
      writeFile(
        join(projectPluginsDir, opencodePluginFilename),
        opencodePluginSource,
      ),
    );
    writes.push(() =>
      writeFile(
        join(profile.xdgConfigOpencode, "opencode.json"),
        JSON.stringify(
          {
            permission: {
              external_directory: {
                [`${normalizePathPattern(profile.dir)}/**`]: "allow",
              },
            },
          },
          null,
          2,
        ),
      ),
    );
    const results: PromiseSettledResult<unknown>[] = [];
    for (const write of writes) {
      try {
        results.push({
          status: "fulfilled",
          value: await write(),
        });
      } catch (reason) {
        results.push({
          status: "rejected",
          reason,
        });
      }
    }
    const errors = results
      .filter(
        (r): r is PromiseRejectedResult =>
          r.status === "rejected" && r.reason?.code !== "EEXIST",
      )
      .map((r) => r.reason);
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new Errors(...errors);
    const username = "openkitten";
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
        OPENKITTEN_OPENCODE_DIR: configDir,
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
      if ((await quiet.exited) !== 0) cancel();
      process.stderr.write(
        boxen(styleText("bold", "OpenCode"), { padding: 1 }),
      );
      const interactive = Bun.spawn([bin, "providers", "list"], {
        cwd: config.cwd,
        env: config.env,
        stdio: ["inherit", "inherit", "inherit"],
      });
      if ((await interactive.exited) !== 0) cancel();
      if (!options.skipActions) {
        let action: string | symbol;
        do {
          clack.intro("Actions");
          action = await clack.select({
            message: "What would you like to do?",
            initialValue: "continue",
            options: [
              {
                value: "add",
                label: "Add credential",
                hint: "ChatGPT, Claude, OpenAI, Anthropic, OpenRouter, etc.",
              },
              { value: "remove", label: "Remove credential" },
              { value: "model", label: "Change model" },
              { value: "continue", label: "Continue" },
            ],
          });
          if (clack.isCancel(action)) cancel();
          clack.outro("Done");
          if (action === "add") {
            process.stderr.write("\x1b[1A");
            const proc = Bun.spawn([bin, "providers", "login"], {
              cwd: config.cwd,
              env: config.env,
              stdio: ["inherit", "inherit", "inherit"],
            });
            if ((await proc.exited) !== 0) cancel();
          } else if (action === "remove") {
            process.stderr.write("\x1b[1A");
            const proc = Bun.spawn([bin, "providers", "logout"], {
              cwd: config.cwd,
              env: config.env,
              stdio: ["inherit", "inherit", "inherit"],
            });
            if ((await proc.exited) !== 0) cancel();
          } else if (action === "model") {
            clack.intro("Change model");
            const modelsProc = Bun.spawn([bin, "models"], {
              cwd: config.cwd,
              env: config.env,
              stdio: ["ignore", "pipe", "ignore"],
            });
            if ((await modelsProc.exited) !== 0) cancel();
            const models = (await new Response(modelsProc.stdout).text())
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            const configPath = join(configDir, "opencode.json");
            const configJson = JSON.parse(await readFile(configPath, "utf-8"));
            const model = await clack.autocomplete({
              message: "Select model",
              initialValue: configJson.model as string | undefined,
              options: models.map((m) => ({ value: m, label: m })),
            });
            if (clack.isCancel(model)) cancel();
            configJson.model = model;
            await writeFile(configPath, JSON.stringify(configJson, null, 2));
            clack.outro("Done");
          }
        } while (action !== "continue");
      }
    }
    return config;
  }
}
