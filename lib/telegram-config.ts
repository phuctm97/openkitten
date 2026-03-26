import { join } from "node:path";
import { styleText } from "node:util";
import * as clack from "@clack/prompts";
import boxen from "boxen";
import { Api, GrammyError } from "grammy";
import zod from "zod";
import { formatPath } from "~/lib/format-path";
import { isTTY } from "~/lib/is-tty";
import type { Profile } from "~/lib/profile";

const botTokenPattern = /^\d+:[A-Za-z0-9_-]{35}$/;
const botTokenError = "Bot token must match <bot_id>:<secret> format";

const hintOptions = { symbol: styleText("cyan", "ℹ") };

const schema = zod.object({
  botToken: zod.string().regex(botTokenPattern, botTokenError),
  userId: zod.int().positive(),
});

function require<T>(value: T | symbol): T {
  if (clack.isCancel(value)) {
    clack.cancel("Config is cancelled");
    throw new TelegramConfig.CancelledError();
  }
  return value;
}

async function promptBotToken(): Promise<string> {
  clack.log.message(
    "Get a bot token from @BotFather: https://t.me/BotFather",
    hintOptions,
  );
  for (;;) {
    const botToken = require(
      await clack.password({
        message: "Telegram bot token:",
        validate: (value) => {
          if (!value || !botTokenPattern.test(value)) return botTokenError;
          return undefined;
        },
      }),
    );
    const s = clack.spinner();
    s.start("Verifying bot token");
    try {
      const me = await new Api(botToken).getMe();
      s.stop(`Verified bot: ${me.first_name} (@${me.username})`);
      return botToken;
    } catch (e) {
      if (e instanceof GrammyError) {
        s.error("Bot token is invalid, please try again");
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
      message: "Telegram user ID:",
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
    if (isTTY) {
      process.stderr.write(
        `${boxen(styleText("bold", "Telegram"), { padding: 1 })}\n`,
      );
    }
    const file = Bun.file(path);
    if (await file.exists()) {
      const result = schema.safeParse(await file.json());
      if (result.success) {
        if (isTTY) {
          clack.intro(`Config ${styleText("dim", formatPath(path))}`);
          clack.outro("Valid config");
        }
        return result.data;
      }
    }
    if (!isTTY) throw new TelegramConfig.NotFoundError(path);
    clack.intro(`Config ${styleText("dim", formatPath(path))}`);
    const botToken = await promptBotToken();
    const userId = await promptUserId();
    const config = schema.parse({ botToken, userId });
    await Bun.write(path, JSON.stringify(config), { mode: 0o600 });
    clack.outro("Config is saved");
    return config;
  }
}
