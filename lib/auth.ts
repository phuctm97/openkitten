import * as clack from "@clack/prompts";
import zod from "zod";

const schema = zod.object({
  telegram: zod.object({
    botToken: zod.string().min(1),
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
    if (!clack.isTTY(process.stdin) || !clack.isTTY(process.stdout))
      throw new Auth.NotFoundError();
    clack.intro("🔐 Auth");
    const botToken = require(
      await clack.password({
        message: "Telegram bot token:",
        validate: (value) => {
          if (!value) return "Bot token is required";
          return undefined;
        },
      }),
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
