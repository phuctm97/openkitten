import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { Bot } from "~/lib/bot";
import { cli } from "~/lib/cli";
import { Scripts } from "~/lib/scripts";

const projectDir = resolve(import.meta.dir, "..");

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

function getuid() {
  if (!process.getuid) throw new MissingGetuidError();
  return process.getuid();
}

async function update() {
  const branch = (
    await Bun.$`git rev-parse --abbrev-ref HEAD`.cwd(projectDir).text()
  ).trim();
  if (branch !== "main") {
    console.log("Skipping update: not on main branch");
    return;
  }
  const status = (
    await Bun.$`git status --porcelain`.cwd(projectDir).text()
  ).trim();
  if (status !== "") {
    console.log("Skipping update: worktree is dirty");
    return;
  }
  await Bun.$`git pull`.cwd(projectDir);
  await Bun.$`bun install`.cwd(projectDir);
}

async function installDarwin() {
  const uid = getuid();
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
  <string>${logsDir}/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${logsDir}/stderr.log</string>
</dict>
</plist>
`;
  await Promise.all([
    mkdir(logsDir, { recursive: true }),
    mkdir(plistDir, { recursive: true }),
  ]);
  await Bun.write(plistPath, plistContent);
  await Bun.$`launchctl bootout gui/${uid}/${launchctlService}`.nothrow();
  await Bun.$`launchctl bootstrap gui/${uid} ${plistPath}`;
  console.log(`Service installed: ${plistPath}`);
}

async function uninstallDarwin() {
  const uid = getuid();
  const logsDir = `${homedir()}/Library/Logs/${launchctlService}`;
  const plistPath = `${homedir()}/Library/LaunchAgents/${launchctlService}.plist`;
  await Bun.$`launchctl bootout gui/${uid}/${launchctlService}`.nothrow();
  await Promise.all([
    rm(logsDir, { force: true, recursive: true }),
    rm(plistPath, { force: true }),
  ]);
  console.log("Service removed.");
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
  await mkdir(unitDir, { recursive: true });
  await Bun.write(unitPath, unitContent);
  await Bun.$`systemctl --user daemon-reload`;
  await Bun.$`systemctl --user enable --now ${systemctlService}`;
  console.log(`Service installed: ${unitPath}`);
}

async function uninstallLinux() {
  await Bun.$`systemctl --user disable --now ${systemctlService}`;
  const unitPath = `${homedir()}/.config/systemd/user/${systemctlService}.service`;
  await rm(unitPath, { force: true });
  await Bun.$`systemctl --user daemon-reload`;
  console.log("Service removed.");
}

const scriptsLayer = Layer.succeed(Scripts, {
  up: async () => {
    await update();
    switch (process.platform) {
      case "darwin":
        return installDarwin();
      case "linux":
        return installLinux();
      default:
        throw new UnsupportedPlatformError();
    }
  },
  down: async () => {
    switch (process.platform) {
      case "darwin":
        return uninstallDarwin();
      case "linux":
        return uninstallLinux();
      default:
        throw new UnsupportedPlatformError();
    }
  },
});

const runLayer = Layer.mergeAll(BunContext.layer, scriptsLayer).pipe(
  Layer.provideMerge(Bot.layer),
);

cli(Bun.argv).pipe(Effect.provide(runLayer), BunRuntime.runMain);
