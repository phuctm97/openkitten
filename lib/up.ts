import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { styleText } from "node:util";
import * as clack from "@clack/prompts";
import { defineCommand } from "citty";
import { getProfile } from "~/lib/get-profile";
import { getUserId } from "~/lib/get-user-id";

const projectDir = resolve(import.meta.dirname, "..");

async function runTask(
  title: string,
  success: string,
  cmd: string[],
): Promise<void> {
  const tl = clack.taskLog({ title });
  const proc = Bun.spawn(cmd, {
    cwd: projectDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const forward = async (stream: ReadableStream<Uint8Array>): Promise<void> => {
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

async function updateProjectDir(): Promise<void> {
  const branch = (
    await Bun.$`git rev-parse --abbrev-ref HEAD`.cwd(projectDir).text()
  ).trim();
  if (branch !== "main") {
    clack.log.warn(`Skipped update\n${styleText("dim", "Not on main branch")}`);
    return;
  }
  const status = (
    await Bun.$`git status --porcelain`.cwd(projectDir).text()
  ).trim();
  if (status !== "") {
    clack.log.warn(`Skipped update\n${styleText("dim", "Worktree is dirty")}`);
    return;
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

async function installLinux(profile: string): Promise<void> {
  const label = `openkitten-${profile}-profile`;
  const unitDir = `${homedir()}/.config/systemd/user`;
  const unitPath = `${unitDir}/${label}.service`;
  const unitContent = `[Unit]
Description=OpenKitten (${profile})
After=network.target

[Service]
Environment=OPENKITTEN_PROFILE=${profile}
ExecStart=${process.execPath} . serve
WorkingDirectory=${projectDir}
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
`;
  const s = clack.spinner({ indicator: "timer" });
  s.start("Installing service");
  const wasRunning =
    (await Bun.$`systemctl --user is-active ${label}`.nothrow().quiet())
      .exitCode === 0;
  if (wasRunning) s.message("Restarting service");
  await mkdir(unitDir, { recursive: true });
  await Bun.write(unitPath, unitContent);
  await Bun.$`systemctl --user daemon-reload`;
  if (wasRunning) {
    await Bun.$`systemctl --user restart ${label}`;
  } else {
    await Bun.$`systemctl --user enable --now ${label}`;
  }
  s.stop(wasRunning ? "Restarted service" : "Installed service");
  clack.note(
    `Open Telegram and say hi to your kitten!\n\nTo update:\n  bun . up\n\nTo uninstall:\n  bun . down\n\nTroubleshooting:\n  journalctl --user -u ${label} -f`,
    "Next steps",
  );
}

async function installDarwin(profile: string): Promise<void> {
  const userId = getUserId();
  const label = `com.openkitten.profiles.${profile}`;
  const logsDir = `${homedir()}/Library/Logs/OpenKitten`;
  const plistDir = `${homedir()}/Library/LaunchAgents`;
  const plistPath = `${plistDir}/${label}.plist`;
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>OPENKITTEN_PROFILE</key>
    <string>${profile}</string>
  </dict>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>.</string>
    <string>serve</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${projectDir}</string>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logsDir}/${label}.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${logsDir}/${label}.stderr.log</string>
</dict>
</plist>
`;
  const s = clack.spinner({ indicator: "timer" });
  s.start("Installing service");
  const wasRunning =
    (await Bun.$`launchctl bootout gui/${userId}/${label}`.nothrow().quiet())
      .exitCode === 0;
  if (wasRunning) s.message("Restarting service");
  await Promise.all([
    mkdir(logsDir, { recursive: true }),
    mkdir(plistDir, { recursive: true }),
  ]);
  await Bun.write(plistPath, plistContent);
  await Bun.$`launchctl bootstrap gui/${userId} ${plistPath}`;
  s.stop(wasRunning ? "Restarted service" : "Installed service");
  clack.note(
    `Open Telegram and say hi to your kitten!\n\nTo update:\n  bun . up\n\nTo uninstall:\n  bun . down\n\nTroubleshooting:\n  tail -f ~/Library/Logs/OpenKitten/${label}.*.log\n  or open Console.app and filter by "${label}"`,
    "Next steps",
  );
}

async function installWin32(profile: string): Promise<void> {
  const taskName = `\\OpenKitten\\Profiles\\${profile}`;
  const s = clack.spinner({ indicator: "timer" });
  s.start("Installing service");
  const wasRunning =
    (await Bun.$`schtasks /Query /TN ${taskName}`.nothrow().quiet())
      .exitCode === 0;
  if (wasRunning) s.message("Restarting service");
  const tr = `cmd /C "cd /D \\"${projectDir}\\" && set OPENKITTEN_PROFILE=${profile} && \\"${process.execPath}\\" . serve"`;
  await Bun.$`schtasks /Create /SC ONLOGON /TN ${taskName} /TR ${tr} /F`;
  s.stop(wasRunning ? "Restarted service" : "Installed service");
  clack.note(
    `Open Telegram and say hi to your kitten!\n\nTo update:\n  bun . up\n\nTo uninstall:\n  bun . down\n\nTroubleshooting:\n  Open Task Scheduler and look for "${taskName}"`,
    "Next steps",
  );
}

export const up = defineCommand({
  meta: { description: "Install and update OpenKitten as a system service." },
  run: async () => {
    clack.intro("😼 OpenKitten");
    await updateProjectDir();
    const profile = getProfile();
    switch (process.platform) {
      case "linux":
        await installLinux(profile);
        break;
      case "darwin":
        await installDarwin(profile);
        break;
      case "win32":
        await installWin32(profile);
        break;
      default:
        throw new Error(`${process.platform} is not supported yet`);
    }
    clack.outro("Meow! Your kitten is up and running. 😻");
  },
});
