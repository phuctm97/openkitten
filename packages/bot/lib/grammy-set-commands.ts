import { Api } from "grammy";

const adminCommands = new Set(["start", "abort", "compact", "agent"]);

export async function grammySetCommands(
  botToken: string,
  commands: readonly { command: string; description: string }[],
  groupChat = false,
): Promise<void> {
  const api = new Api(botToken);

  if (!groupChat) {
    await api.setMyCommands([...commands]);
    return;
  }

  // Group chat enabled: set scoped commands
  await Promise.all([
    api.setMyCommands([...commands], {
      scope: { type: "all_private_chats" },
    }),
    api.setMyCommands(
      commands.map((cmd) => ({
        command: cmd.command,
        description: adminCommands.has(cmd.command)
          ? `${cmd.description} (owner only)`
          : cmd.description,
      })),
      { scope: { type: "all_group_chats" } },
    ),
  ]);
}
