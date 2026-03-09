import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { styleText } from "node:util";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  spinner,
  taskLog,
} from "@clack/prompts";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { Bot } from "~/lib/bot";
import { cli } from "~/lib/cli";
import { makeDatabaseLayer } from "~/lib/make-database-layer";
import { OpenCode } from "~/lib/opencode";
import { SandboxRuntimeConfig } from "~/lib/sandbox-runtime-config";
import { Scripts } from "~/lib/scripts";
import { Shell } from "~/lib/shell";

const projectDir = resolve(import.meta.dirname, "..");

const launchctlService = "com.openkitten.bot";

const systemctlService = "openkitten-bot";

class UnsupportedPlatformError extends Error {
  constructor() {
    super(`${process.platform} is not supported yet`);
  }
}

class MissingGetuidError extends Error {
  constructor() {
    super("getuid is not available");
  }
}

function getUserId() {
  if (!process.getuid) throw new MissingGetuidError();
  return process.getuid();
}

function getDataDir() {
  switch (process.platform) {
    case "darwin":
      return `${homedir()}/Library/Application Support/OpenKitten`;
    case "linux":
      return `${homedir()}/.local/share/openkitten`;
    default:
      throw new UnsupportedPlatformError();
  }
}

async function ensureDataDir() {
  const dataDir = getDataDir();
  await mkdir(dataDir, { recursive: true });
  return dataDir;
}

async function runTask(title: string, success: string, cmd: string[]) {
  const tl = taskLog({ title });
  const proc = Bun.spawn(cmd, {
    cwd: projectDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const forward = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
      for (const line of decoder.decode(chunk).split("\n")) {
        if (line) tl.message(line);
      }
    }
  };
  await Promise.all([forward(proc.stdout), forward(proc.stderr)]);
  const code = await proc.exited;
  if (code === 0) {
    tl.success(success);
  } else {
    tl.error(`Failed with exit code ${code}`, { showLog: true });
    throw new Error(`${cmd.join(" ")} exited with code ${code}`);
  }
}

async function updateProjectDir() {
  const branch = (
    await Bun.$`git rev-parse --abbrev-ref HEAD`.cwd(projectDir).text()
  ).trim();
  if (branch !== "main") {
    return log.warn(
      `Skipped update\n${styleText("dim", "Not on main branch")}`,
    );
  }
  const status = (
    await Bun.$`git status --porcelain`.cwd(projectDir).text()
  ).trim();
  if (status !== "") {
    return log.warn(`Skipped update\n${styleText("dim", "Worktree is dirty")}`);
  }
  await runTask("Pulling latest changes", "Pulled latest changes", [
    "git",
    "pull",
  ]);
  await runTask("Installing dependencies", "Installed dependencies", [
    "bun",
    "install",
  ]);
}

async function installDarwin() {
  const userId = getUserId();
  const logsDir = `${homedir()}/Library/Logs/${launchctlService}`;
  const plistDir = `${homedir()}/Library/LaunchAgents`;
  const plistPath = `${plistDir}/${launchctlService}.plist`;
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${launchctlService}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${projectDir}</string>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logsDir}/${launchctlService}.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${logsDir}/${launchctlService}.stderr.log</string>
</dict>
</plist>
`;
  const s = spinner({ indicator: "timer" });
  s.start("Installing service");
  const wasRunning =
    (
      await Bun.$`launchctl bootout gui/${userId}/${launchctlService}`
        .nothrow()
        .quiet()
    ).exitCode === 0;
  if (wasRunning) s.message("Restarting service");
  await Promise.all([
    mkdir(logsDir, { recursive: true }),
    mkdir(plistDir, { recursive: true }),
  ]);
  await Bun.write(plistPath, plistContent);
  await Bun.$`launchctl bootstrap gui/${userId} ${plistPath}`;
  s.stop(wasRunning ? "Restarted service" : "Installed service");
  note(
    `Open Telegram and say hi to your kitten!\n\nTo update:\n  bun up\n\nTo uninstall:\n  bun down\n\nTroubleshooting:\n  tail -f ~/Library/Logs/${launchctlService}/*.log\n  or open Console.app and filter by "${launchctlService}"`,
    "Next steps",
  );
}

async function uninstallDarwin() {
  const userId = getUserId();
  const logsDir = `${homedir()}/Library/Logs/${launchctlService}`;
  const plistPath = `${homedir()}/Library/LaunchAgents/${launchctlService}.plist`;
  const s = spinner({ indicator: "timer" });
  s.start("Removing service");
  await Bun.$`launchctl bootout gui/${userId}/${launchctlService}`
    .nothrow()
    .quiet();
  await Promise.all([
    rm(logsDir, { force: true, recursive: true }),
    rm(plistPath, { force: true }),
  ]);
  s.stop("Removed service");
}

async function installLinux() {
  const unitDir = `${homedir()}/.config/systemd/user`;
  const unitPath = `${unitDir}/${systemctlService}.service`;
  const unitContent = `[Unit]
Description=OpenKitten
After=network.target

[Service]
ExecStart=${process.execPath} start
WorkingDirectory=${projectDir}
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
`;
  const s = spinner({ indicator: "timer" });
  s.start("Installing service");
  const wasRunning =
    (
      await Bun.$`systemctl --user is-active ${systemctlService}`
        .nothrow()
        .quiet()
    ).exitCode === 0;
  if (wasRunning) s.message("Restarting service");
  await mkdir(unitDir, { recursive: true });
  await Bun.write(unitPath, unitContent);
  await Bun.$`systemctl --user daemon-reload`;
  if (wasRunning) {
    await Bun.$`systemctl --user restart ${systemctlService}`;
  } else {
    await Bun.$`systemctl --user enable --now ${systemctlService}`;
  }
  s.stop(wasRunning ? "Restarted service" : "Installed service");
  note(
    `Open Telegram and say hi to your kitten!\n\nTo update:\n  bun up\n\nTo uninstall:\n  bun down\n\nTroubleshooting:\n  journalctl --user -u ${systemctlService} -f`,
    "Next steps",
  );
}

async function uninstallLinux() {
  const s = spinner({ indicator: "timer" });
  s.start("Removing service");
  await Bun.$`systemctl --user disable --now ${systemctlService}`;
  const unitPath = `${homedir()}/.config/systemd/user/${systemctlService}.service`;
  await rm(unitPath, { force: true });
  await Bun.$`systemctl --user daemon-reload`;
  s.stop("Removed service");
}

const shellLayer = Layer.succeed(
  Shell,
  (strings: TemplateStringsArray, ...values: Shell.Value[]) => {
    const makeCommand = (dir?: string): Shell.Command =>
      Object.assign(
        Effect.promise(async () => {
          let cmd = Bun.$(strings, ...values);
          if (dir) cmd = cmd.cwd(dir);
          return cmd.text();
        }),
        { cwd: (d: string) => makeCommand(d) },
      );
    return makeCommand();
  },
);

const databaseLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const dataDir = yield* Effect.promise(ensureDataDir);
    return makeDatabaseLayer(`${dataDir}/bot.db`);
  }),
);

const serverLayer = Bot.layer.pipe(
  Layer.provideMerge(OpenCode.layer),
  Layer.provideMerge(SandboxRuntimeConfig.layer),
  Layer.provideMerge(shellLayer),
  Layer.provideMerge(databaseLayer),
);

const scriptsLayer = Layer.succeed(
  Scripts,
  Scripts.of({
    up: async () => {
      intro("😼 OpenKitten");
      await updateProjectDir();
      switch (process.platform) {
        case "darwin":
          await installDarwin();
          break;
        case "linux":
          await installLinux();
          break;
        default:
          throw new UnsupportedPlatformError();
      }
      outro("Meow! Your kitten is up and running. 😻");
    },
    down: async () => {
      intro("😼 OpenKitten");
      const shouldContinue = await confirm({
        message: "Are you sure you want to uninstall OpenKitten?",
      });
      if (isCancel(shouldContinue) || !shouldContinue) {
        cancel("Phew! Your kitten lives another day. 😻");
        return;
      }
      switch (process.platform) {
        case "darwin":
          await uninstallDarwin();
          break;
        case "linux":
          await uninstallLinux();
          break;
        default:
          throw new UnsupportedPlatformError();
      }
      note(`To reinstall:\n  bun up`, "Changed your mind?");
      outro("Your kitten has left the chat. 😿");
    },
  }),
);

cli({ argv: Bun.argv, serverLayer, scriptsLayer }).pipe(
  Effect.provide(BunContext.layer),
  BunRuntime.runMain,
);
