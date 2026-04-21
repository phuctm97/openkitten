import { resolve } from "node:path";
import type { Bot } from "grammy";
import type { Database } from "~/lib/database";
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

function respawn(): void {
  if (Bun.env["OPENKITTEN_PROFILE"]) {
    logger.info("Relying on service manager to respawn");
    return;
  }
  // --yes tells the detached child to skip the interactive config-actions
  // menu. No human is at the terminal during an upgrade, and the child's
  // stdin is /dev/null — any prompt would deadlock the new process.
  const cmd = [process.execPath, ...process.argv.slice(1), "--yes"];
  logger.info("Spawning detached respawner", { cmd });
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

// Runs privileged shell commands on the bot host (git pull, bun install) and
// restarts the process. Access must stay gated by grammyFilterChat to the
// single configured TELEGRAM_USER_ID.
export async function upgradeOpenkitten(
  options: UpgradeOpenkittenOptions,
): Promise<UpgradeOpenkittenResult> {
  const branch = (
    await capture(["git", "rev-parse", "--abbrev-ref", "HEAD"])
  ).trim();
  // TODO(temp): remove the "feat/upgrade-command" allowance before merging to main.
  if (branch !== "main" && branch !== "feat/upgrade-command") {
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
    logger.info("Already up to date", { sha: shortSha(previousSha) });
    return { kind: "up-to-date", sha: shortSha(previousSha) };
  }

  logger.info("Upgrading OpenKitten", {
    previousSha: shortSha(previousSha),
    upstreamSha: shortSha(upstreamSha),
  });

  await capture(["git", "pull", "--ff-only", "origin", branch]);
  await capture(["bun", "install"]);

  const nextSha = (await capture(["git", "rev-parse", "HEAD"])).trim();

  await notifySessions(options.bot, options.database, previousSha, nextSha);

  respawn();

  logger.info("Upgrade prepared, ready to restart", {
    previousSha: shortSha(previousSha),
    nextSha: shortSha(nextSha),
  });

  return {
    kind: "restarting",
    previousSha: shortSha(previousSha),
    nextSha: shortSha(nextSha),
  };
}
