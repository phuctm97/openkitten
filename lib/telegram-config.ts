import { join } from "node:path";
import { styleText } from "node:util";
import * as clack from "@clack/prompts";
import boxen from "boxen";
import { Api, GrammyError } from "grammy";
import zod from "zod";
import { formatPath } from "~/lib/format-path";
import { isTTY } from "~/lib/is-tty";
import { logger } from "~/lib/logger";
import type { Profile } from "~/lib/profile";

const botTokenPattern = /^\d+:[A-Za-z0-9_-]{35}$/;
const botTokenError = "Bot token must match <bot_id>:<bot_secret> format";

const hintOptions = { symbol: styleText("cyan", "ℹ") };

const schema = zod.object({
  botToken: zod.string().regex(botTokenPattern, botTokenError),
  userId: zod.int().positive(),
});

function cancel(): never {
  clack.cancel("Cancelled");
  throw new TelegramConfig.CancelledError();
}

function require<T>(value: T | symbol): T {
  if (clack.isCancel(value)) cancel();
  return value;
}

async function verifyBotToken(botToken: string): Promise<string> {
  const me = await new Api(botToken).getMe();
  return `${me.first_name} (@${me.username})`;
}

async function promptBotToken(): Promise<string> {
  clack.log.message(
    "Create a bot with @BotFather: https://t.me/BotFather",
    hintOptions,
  );
  for (;;) {
    const botToken = require(
      await clack.password({
        message: "Enter your bot token",
        validate: (value) => {
          if (!value || !botTokenPattern.test(value)) return botTokenError;
          return undefined;
        },
      }),
    );
    const s = clack.spinner();
    s.start("Verifying bot token");
    try {
      const bot = await verifyBotToken(botToken);
      s.stop(`Verified bot token: ${bot}`);
      return botToken;
    } catch (e) {
      if (e instanceof GrammyError) {
        s.error("Invalid bot token, try again");
        continue;
      }
      s.error("Failed to verify bot token");
      throw e;
    }
  }
}

async function promptUserId(): Promise<number> {
  clack.log.message(
    "Get your user ID from @userinfobot: https://t.me/userinfobot",
    hintOptions,
  );
  const raw = require(
    await clack.text({
      message: "Enter your user ID",
      validate: (value) => {
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0)
          return "User ID must be a positive integer";
        return undefined;
      },
    }),
  );
  return Number(raw);
}

export interface TelegramConfig extends zod.output<typeof schema> {}

export namespace TelegramConfig {
  export class NotFoundError extends Error {
    constructor(path: string) {
      super(`No valid Telegram config found at ${formatPath(path)}`);
    }
  }

  export class CancelledError extends Error {
    constructor() {
      super("Telegram config is cancelled");
    }
  }

  export async function create(profile: Profile): Promise<TelegramConfig> {
    const path = join(profile.xdgConfig, "openkitten", "telegram.json");

    // Non-TTY: find, parse, validate, or throw
    if (!isTTY) {
      const file = Bun.file(path);
      if (!(await file.exists())) {
        throw new TelegramConfig.NotFoundError(path);
      }
      let json: unknown;
      try {
        json = await file.json();
      } catch (e) {
        logger.error("Failed to load Telegram config", e);
        throw new TelegramConfig.NotFoundError(path);
      }
      const result = schema.safeParse(json);
      if (!result.success) {
        logger.error("Failed to parse Telegram config", result.error);
        throw new TelegramConfig.NotFoundError(path);
      }
      try {
        await verifyBotToken(result.data.botToken);
      } catch (e) {
        if (!(e instanceof GrammyError)) throw e;
        logger.error("Found invalid bot token in Telegram config", e);
        throw new TelegramConfig.NotFoundError(path);
      }
      return result.data;
    }

    // TTY
    process.stderr.write(
      `${boxen(styleText("bold", "Telegram"), { padding: 1 })}\n`,
    );

    let botToken: string | undefined;
    let userId: number | undefined;

    // Load existing config
    const file = Bun.file(path);
    if (await file.exists()) {
      clack.intro(`Config ${styleText("dim", formatPath(path))}`);
      let config: TelegramConfig | undefined;
      try {
        const result = schema.safeParse(await file.json());
        if (result.success) config = result.data;
      } catch {
        // Invalid or unreadable config
      }
      if (config) {
        const s = clack.spinner();
        s.start("Verifying bot token");
        try {
          const bot = await verifyBotToken(config.botToken);
          s.stop(`Verified bot token: ${bot}`);
          botToken = config.botToken;
        } catch (e) {
          if (e instanceof GrammyError) {
            s.error("Invalid bot token");
          } else {
            s.error("Failed to verify bot token");
            throw e;
          }
        }
        userId = config.userId;
        clack.log.info(`User ID: ${userId}`);
      } else {
        clack.log.error("Invalid config");
      }
      clack.outro("Done");
    }

    // Prompt for missing values
    if (!botToken || !userId) {
      clack.intro(`Config ${styleText("dim", formatPath(path))}`);
      botToken = await promptBotToken();
      if (!userId) userId = await promptUserId();
      clack.outro("Done");
    }

    // Action loop
    let action: string | symbol;
    do {
      clack.intro("Actions");
      action = await clack.select({
        message: "What would you like to do?",
        initialValue: "continue",
        options: [
          { value: "bot-token", label: "Change bot token" },
          { value: "user-id", label: "Change user ID" },
          { value: "continue", label: "Continue" },
        ],
      });
      if (clack.isCancel(action)) cancel();
      clack.outro("Done");
      if (action === "bot-token") {
        clack.intro("Change bot token");
        botToken = await promptBotToken();
        clack.outro("Done");
      } else if (action === "user-id") {
        clack.intro("Change user ID");
        userId = await promptUserId();
        clack.outro("Done");
      }
    } while (action !== "continue");

    // Save config
    const config = schema.parse({ botToken, userId });
    await Bun.write(path, JSON.stringify(config), { mode: 0o600 });
    return config;
  }
}
