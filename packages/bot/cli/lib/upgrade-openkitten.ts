import { resolve } from "node:path";
import type { Bot } from "grammy";
import invariant from "tiny-invariant";
import type { Database } from "~/lib/database";
import { getUserId } from "~/lib/get-user-id";
import { logger } from "~/lib/logger";
import * as schema from "~/lib/schema";
import { UpgradeOpenkittenError } from "~/lib/upgrade-openkitten-error";
import type { UpgradeOpenkittenOptions } from "~/lib/upgrade-openkitten-options";
import type { UpgradeOpenkittenResult } from "~/lib/upgrade-openkitten-result";

const repoDir = resolve(import.meta.dirname, "../../..");

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

async function capture(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim();
    throw new UpgradeOpenkittenError(
      detail
        ? `\`${cmd.join(" ")}\` failed: ${detail}`
        : `\`${cmd.join(" ")}\` exited with code ${exitCode}`,
    );
  }
  return stdout;
}

function serviceRestartCommand(): string[] {
  const profileName = Bun.env["OPENKITTEN_PROFILE"];
  if (!profileName) {
    throw new UpgradeOpenkittenError(
      "OPENKITTEN_PROFILE must be set in service-managed mode",
    );
  }
  switch (process.platform) {
    case "darwin": {
      const target = `gui/${getUserId()}/com.openkitten.profiles.${profileName}`;
      return ["sh", "-c", `sleep 2 && launchctl kickstart -k ${target}`];
    }
    case "linux": {
      const label = `openkitten-${profileName}-profile`;
      return ["sh", "-c", `sleep 2 && systemctl --user restart ${label}`];
    }
    case "win32": {
      const taskName = `\\OpenKitten\\Profiles\\${profileName}`;
      return [
        "cmd",
        "/C",
        `timeout /T 2 /NOBREAK > NUL && schtasks /End /TN "${taskName}" & schtasks /Run /TN "${taskName}"`,
      ];
    }
    default:
      throw new UpgradeOpenkittenError(
        `${process.platform} is not supported for service restart`,
      );
  }
}

function respawn(serviceCmd: string[] | null): void {
  if (serviceCmd) {
    const child = Bun.spawn(serviceCmd, {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      detached: true,
    });
    child.unref();
    return;
  }
  const entry = process.argv[1];
  invariant(entry, "process.argv[1] must be the entry script path");
  const cmd = [process.execPath, entry, "serve", "--yes"];
  const child = Bun.spawn(cmd, {
    cwd: process.cwd(),
    env: process.env,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  });
  child.unref();
}

async function notifySessions(
  bot: Bot,
  database: Database,
  previousSha: string,
  nextSha: string,
): Promise<void> {
  const sessions = database.query.session
    .findMany({ columns: { chatId: true, threadId: true } })
    .sync();
  for (const row of sessions) {
    const sendOptions = {
      ...(row.threadId && { message_thread_id: row.threadId }),
    };
    try {
      await bot.api.sendMessage(
        row.chatId,
        "⏳ Upgrading OpenKitten…",
        sendOptions,
      );
    } catch (error) {
      logger.warn("Failed to send upgrade notification", {
        chatId: row.chatId,
        error,
      });
      continue;
    }
    database
      .insert(schema.restartNotification)
      .values({
        chatId: row.chatId,
        threadId: row.threadId,
        message: `✅ Upgraded ${shortSha(previousSha)} → ${shortSha(nextSha)}`,
      })
      .run();
  }
}

export async function upgradeOpenkitten(
  options: UpgradeOpenkittenOptions,
): Promise<UpgradeOpenkittenResult> {
  const serviceCmd = Bun.env["OPENKITTEN_SERVICE_MANAGED"]
    ? serviceRestartCommand()
    : null;

  const branch = (
    await capture(["git", "rev-parse", "--abbrev-ref", "HEAD"])
  ).trim();
  if (branch !== "main") {
    throw new UpgradeOpenkittenError(
      `Cannot upgrade on non-main branch: ${branch}. Switch to main first.`,
    );
  }

  const status = (await capture(["git", "status", "--porcelain"])).trim();
  if (status !== "") {
    throw new UpgradeOpenkittenError(
      "Cannot upgrade with a dirty worktree. Commit or stash local changes first.",
    );
  }

  await capture(["git", "fetch", "origin", branch]);

  const previousSha = (await capture(["git", "rev-parse", "HEAD"])).trim();
  const upstreamSha = (
    await capture(["git", "rev-parse", `origin/${branch}`])
  ).trim();

  if (previousSha === upstreamSha) {
    return { kind: "up-to-date", sha: shortSha(previousSha) };
  }

  await capture(["git", "pull", "--ff-only", "origin", branch]);
  await capture(["bun", "install"]);

  const nextSha = (await capture(["git", "rev-parse", "HEAD"])).trim();

  await notifySessions(options.bot, options.database, previousSha, nextSha);

  respawn(serviceCmd);

  return {
    kind: "restarting",
    previousSha: shortSha(previousSha),
    nextSha: shortSha(nextSha),
  };
}
