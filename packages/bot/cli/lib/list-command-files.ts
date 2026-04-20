import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function listCommandFiles(
  commandsDir: string,
): Promise<{ command: string; description: string }[]> {
  const entries = await readdir(commandsDir).catch(() => []);
  const commands: { command: string; description: string }[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const name = entry.slice(0, -3);
    const content = await readFile(join(commandsDir, entry), "utf-8");
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const descMatch = match?.[1]?.match(/description:\s*(.+)/);
    commands.push({
      command: name,
      description: descMatch?.[1]?.trim() ?? "",
    });
  }
  return commands.sort((a, b) => a.command.localeCompare(b.command));
}
