import { Api } from "grammy";

export async function grammySetCommands(
  botToken: string,
  commands: readonly { command: string; description: string }[],
): Promise<void> {
  await new Api(botToken).setMyCommands([...commands]);
}
