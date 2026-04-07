import { Api } from "grammy";

const commands = [
  { command: "start", description: "Start a new conversation" },
  { command: "abort", description: "Stop the current generation" },
  { command: "compact", description: "Summarize conversation history" },
  { command: "agent", description: "Switch or list AI agents" },
];

export async function grammySetCommands(botToken: string): Promise<void> {
  await new Api(botToken).setMyCommands(commands);
}
