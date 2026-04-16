export const builtinCommands: readonly {
  command: string;
  description: string;
}[] = [
  { command: "start", description: "Start a new conversation" },
  { command: "abort", description: "Stop the current generation" },
  { command: "compact", description: "Summarize conversation history" },
  { command: "agent", description: "Switch or list AI agents" },
];
