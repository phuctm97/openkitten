import * as clack from "@clack/prompts";
import zod from "zod";
import { isTTY } from "~/lib/is-tty";

const botTokenPattern = /^\d+:[A-Za-z0-9_-]{35}$/;
const botTokenError = "Telegram bot token must match <bot_id>:<secret> format";

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
    clack.log.info("Get a bot token from @BotFather: https://t.me/BotFather");
    const botToken = require(
      await clack.password({
        message: "Telegram bot token:",
        validate: (value) => {
          if (!value || !botTokenPattern.test(value)) return botTokenError;
          return undefined;
        },
      }),
    );
    clack.log.info(
      "Get your user ID from @userinfobot: https://t.me/userinfobot",
    );
    const rawUserId = require(
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
    const auth = schema.parse({
      telegram: { botToken, userId: Number(rawUserId) },
    });
    await save(path, auth);
    clack.outro("Auth is saved");
    return auth;
  }
}
