import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { builtinCommands } from "~/lib/builtin-commands";

const builtinNames = new Set(builtinCommands.map((c) => c.command));

const namePattern = /^[a-z][a-z0-9_]{0,30}$/;

class ReservedError extends Error {
  constructor(name: string) {
    super(`Cannot use reserved command name: ${name}`);
  }
}

class DuplicateError extends Error {
  constructor(name: string) {
    super(`Command already exists: ${name}`);
  }
}

class NotFoundError extends Error {
  constructor(name: string) {
    super(`Command not found: ${name}`);
  }
}

function buildSkillMd(
  name: string,
  description: string,
  prompt: string,
): string {
  return [
    "---",
    `name: command-${name}`,
    `description: Handle the /${name} Telegram command — ${description}`,
    "---",
    "",
    `# /${name} Command`,
    "",
    `When the user sends a message starting with \`/${name}\`, execute the following instruction.`,
    "",
    "## Instruction",
    "",
    prompt,
    "",
  ].join("\n");
}

async function list(skillsDir: string): Promise<CommandSkills.Command[]> {
  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    return [];
  }
  const commands: CommandSkills.Command[] = [];
  for (const entry of entries) {
    const jsonPath = join(skillsDir, entry, "command.json");
    try {
      const raw = await readFile(jsonPath, "utf-8");
      const data = JSON.parse(raw) as CommandSkills.Command;
      commands.push({
        name: data.name,
        description: data.description,
        prompt: data.prompt,
      });
    } catch {
      // Skip directories without valid command.json
    }
  }
  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

async function create(
  skillsDir: string,
  input: CommandSkills.CreateInput,
): Promise<CommandSkills.Command> {
  if (builtinNames.has(input.name)) {
    throw new ReservedError(input.name);
  }
  if (!namePattern.test(input.name)) {
    throw new Error(
      `Invalid command name "${input.name}": must match ${namePattern}`,
    );
  }
  const dir = join(skillsDir, input.name);
  const jsonPath = join(dir, "command.json");
  try {
    await readFile(jsonPath, "utf-8");
    throw new DuplicateError(input.name);
  } catch (error) {
    if (error instanceof DuplicateError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(dir, { recursive: true });
  const command: CommandSkills.Command = {
    name: input.name,
    description: input.description,
    prompt: input.prompt,
  };
  await Promise.all([
    writeFile(
      join(dir, "SKILL.md"),
      buildSkillMd(input.name, input.description, input.prompt),
    ),
    writeFile(jsonPath, JSON.stringify(command, null, 2)),
  ]);
  return command;
}

async function deleteCommand(skillsDir: string, name: string): Promise<void> {
  const dir = join(skillsDir, name);
  try {
    await readFile(join(dir, "command.json"), "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NotFoundError(name);
    }
    throw error;
  }
  await rm(dir, { recursive: true, force: true });
}

function toTelegramCommands(
  commands: readonly CommandSkills.Command[],
): readonly { command: string; description: string }[] {
  return commands.map((c) => ({ command: c.name, description: c.description }));
}

export const CommandSkills = {
  namePattern,
  ReservedError,
  DuplicateError,
  NotFoundError,
  list,
  create,
  delete: deleteCommand,
  toTelegramCommands,
} as const;

export namespace CommandSkills {
  export interface Command {
    readonly name: string;
    readonly description: string;
    readonly prompt: string;
  }

  export interface CreateInput {
    readonly name: string;
    readonly description: string;
    readonly prompt: string;
  }
}
