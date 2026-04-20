import { Api } from "grammy";

export async function grammySetCommands(
  botToken: string,
  commands: readonly { command: string; description: string }[],
): Promise<void> {
  const api = new Api(botToken);
  await Promise.all([
    api.deleteMyCommands({ scope: { type: "all_private_chats" } }),
    api.deleteMyCommands({ scope: { type: "all_group_chats" } }),
    api.deleteMyCommands({ scope: { type: "all_chat_administrators" } }),
  ]);
  await api.setMyCommands([...commands]);
}
