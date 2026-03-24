import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import * as clack from "@clack/prompts";
import { defineCommand } from "citty";
import { getUserId } from "~/lib/get-user-id";
import { Profile } from "~/lib/profile";

async function uninstallLinux(profile: Profile): Promise<void> {
  const label = `openkitten-${profile.name}-profile`;
  const unitPath = `${homedir()}/.config/systemd/user/${label}.service`;
  const s = clack.spinner({ indicator: "timer" });
  s.start("Removing service");
  await Bun.$`systemctl --user disable --now ${label}`.nothrow().quiet();
  await rm(unitPath, { force: true });
  await Bun.$`systemctl --user daemon-reload`;
  s.stop("Removed service");
}

async function uninstallDarwin(profile: Profile): Promise<void> {
  const userId = getUserId();
  const label = `com.openkitten.profiles.${profile.name}`;
  const logsDir = `${homedir()}/Library/Logs/OpenKitten`;
  const plistPath = `${homedir()}/Library/LaunchAgents/${label}.plist`;
  const s = clack.spinner({ indicator: "timer" });
  s.start("Removing service");
  await Bun.$`launchctl bootout gui/${userId}/${label}`.nothrow().quiet();
  await Promise.all([
    rm(`${logsDir}/${label}.stdout.log`, { force: true }),
    rm(`${logsDir}/${label}.stderr.log`, { force: true }),
    rm(plistPath, { force: true }),
  ]);
  s.stop("Removed service");
}

async function uninstallWin32(profile: Profile): Promise<void> {
  const taskName = `\\OpenKitten\\Profiles\\${profile.name}`;
  const s = clack.spinner({ indicator: "timer" });
  s.start("Removing service");
  await Bun.$`schtasks /Delete /TN ${taskName} /F`.nothrow().quiet();
  s.stop("Removed service");
}

export const down = defineCommand({
  meta: { description: "Stop and remove OpenKitten from system services." },
  run: async () => {
    clack.intro("😼 OpenKitten");
    const shouldContinue = await clack.confirm({
      message: "Are you sure you want to uninstall OpenKitten?",
    });
    if (clack.isCancel(shouldContinue) || !shouldContinue) {
      clack.cancel("Phew! Your kitten lives another day. 😸");
      return;
    }
    const profile = await Profile.create();
    switch (process.platform) {
      case "linux":
        await uninstallLinux(profile);
        break;
      case "darwin":
        await uninstallDarwin(profile);
        break;
      case "win32":
        await uninstallWin32(profile);
        break;
      default:
        throw new Error(`${process.platform} is not supported yet`);
    }
    clack.note("To reinstall:\n  bun . up", "Changed your mind?");
    clack.outro("Your kitten has left the chat. 😿");
  },
});
