import { styleText } from "node:util";
import * as clack from "@clack/prompts";
import { Api, GrammyError } from "grammy";
import zod from "zod";
import { isTTY } from "~/lib/is-tty";

const botTokenPattern = /^\d+:[A-Za-z0-9_-]{35}$/;
const botTokenError = "Bot token must match <bot_id>:<secret> format";

const hintOptions = { symbol: styleText("cyan", "ℹ") };

const schema = zod.object({
  telegram: zod.object({
    botToken: zod.string().regex(botTokenPattern, botTokenError),
    userId: zod.int().positive(),
  }),
});

function require<T>(value: T | symbol): T {
  if (clack.isCancel(value)) {
    clack.cancel("Auth is cancelled");
    throw new Auth.NotFoundError();
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

async function save(path: string, auth: Auth): Promise<void> {
  await Bun.write(path, JSON.stringify(auth), { mode: 0o600 });
}

export type Auth = zod.output<typeof schema>;

export namespace Auth {
  export class NotFoundError extends Error {
    constructor() {
      super("No valid auth found");
    }
  }

  export async function load(path: string): Promise<Auth> {
    const file = Bun.file(path);
    if (await file.exists()) {
      const result = schema.safeParse(await file.json());
      if (result.success) return result.data;
    }
    if (!isTTY) throw new Auth.NotFoundError();
    clack.intro("🔐 Auth");
    const botToken = await promptBotToken();
    const userId = await promptUserId();
    const auth = schema.parse({ telegram: { botToken, userId } });
    await save(path, auth);
    clack.outro("Auth is saved");
    return auth;
  }
}
