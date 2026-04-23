import { isUpgradeEnabled } from "~/lib/is-upgrade-enabled";

export function builtinCommands(): readonly {
  command: string;
  description: string;
}[] {
  const commands = [
    { command: "start", description: "Start a new conversation" },
    { command: "abort", description: "Stop the current generation" },
    { command: "compact", description: "Summarize conversation history" },
    { command: "agent", description: "Switch or list AI agents" },
  ];
  if (isUpgradeEnabled()) {
    commands.push({
      command: "upgrade",
      description: "Update OpenKitten and restart",
    });
  }
  return commands;
}
