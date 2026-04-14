import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const xdgConfig =
  Bun.env["XDG_CONFIG_HOME"] ?? join(Bun.env["HOME"] ?? "", ".config");
const skillsDir = join(xdgConfig, "opencode", "skills");
const configPath = join(xdgConfig, "openkitten", "telegram.json");

const configFile = Bun.file(configPath);
if (!(await configFile.exists())) {
  process.stderr.write(`Error: ${configPath} not found\n`);
  process.exit(1);
}

const config: { botToken: string } = await configFile.json();

const builtinCommands = [
  { command: "start", description: "Start a new conversation" },
  { command: "abort", description: "Stop the current generation" },
  { command: "compact", description: "Summarize conversation history" },
  { command: "agent", description: "Switch or list AI agents" },
];

interface Command {
  readonly name: string;
  readonly description: string;
  readonly prompt: string;
}

const customCommands: { command: string; description: string }[] = [];

let entries: string[];
try {
  entries = await readdir(skillsDir);
} catch {
  entries = [];
}

for (const entry of entries) {
  const jsonPath = join(skillsDir, entry, "command.json");
  try {
    const raw = await readFile(jsonPath, "utf-8");
    const data = JSON.parse(raw) as Command;
    customCommands.push({ command: data.name, description: data.description });
  } catch {
    // skip non-command directories
  }
}

customCommands.sort((a, b) => a.command.localeCompare(b.command));

const allCommands = [...builtinCommands, ...customCommands];

const response = await fetch(
  `https://api.telegram.org/bot${config.botToken}/setMyCommands`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands: allCommands }),
  },
);

let result: { ok: boolean };
try {
  result = await response.json();
} catch {
  process.stderr.write(
    `Error: setMyCommands returned non-JSON response (status ${response.status})\n`,
  );
  process.exit(1);
}

if (!result.ok) {
  process.stderr.write(
    `Error: setMyCommands failed: ${JSON.stringify(result)}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Updated Telegram command menu: ${allCommands.length} commands\n`,
);
