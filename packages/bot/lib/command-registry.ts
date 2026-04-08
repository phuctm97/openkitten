import { eq, sql } from "drizzle-orm";
import type { Database } from "~/lib/database";
import * as schema from "~/lib/schema";

const builtinNames = new Set(["start", "abort", "compact", "agent"]);

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

export class CommandRegistry {
  readonly #database: Database;
  readonly #commands: Map<string, CommandRegistry.Command>;

  static readonly builtins: readonly CommandRegistry.TelegramCommand[] = [
    { command: "start", description: "Start a new conversation" },
    { command: "abort", description: "Stop the current generation" },
    { command: "compact", description: "Summarize conversation history" },
    { command: "agent", description: "Switch or list AI agents" },
  ];

  static readonly ReservedError = ReservedError;
  static readonly DuplicateError = DuplicateError;
  static readonly NotFoundError = NotFoundError;

  private constructor(
    database: Database,
    commands: Map<string, CommandRegistry.Command>,
  ) {
    this.#database = database;
    this.#commands = commands;
  }

  get(name: string): CommandRegistry.Command | undefined {
    return this.#commands.get(name);
  }

  list(): readonly CommandRegistry.Command[] {
    return [...this.#commands.values()];
  }

  create(input: CommandRegistry.CreateInput): CommandRegistry.Command {
    if (builtinNames.has(input.name)) {
      throw new ReservedError(input.name);
    }
    if (this.#commands.has(input.name)) {
      throw new DuplicateError(input.name);
    }
    this.#database
      .insert(schema.command)
      .values({
        name: input.name,
        description: input.description,
        prompt: input.prompt,
      })
      .run();
    const command: CommandRegistry.Command = {
      name: input.name,
      description: input.description,
      prompt: input.prompt,
    };
    this.#commands.set(input.name, command);
    return command;
  }

  update(input: CommandRegistry.UpdateInput): CommandRegistry.Command {
    const existing = this.#commands.get(input.name);
    if (!existing) {
      throw new NotFoundError(input.name);
    }
    const updated: CommandRegistry.Command = {
      name: existing.name,
      description: input.description ?? existing.description,
      prompt: input.prompt ?? existing.prompt,
    };
    this.#database
      .update(schema.command)
      .set({
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.prompt !== undefined && { prompt: input.prompt }),
        updatedAt: sql`(unixepoch() * 1000)`,
      })
      .where(eq(schema.command.name, input.name))
      .run();
    this.#commands.set(input.name, updated);
    return updated;
  }

  delete(name: string): void {
    if (!this.#commands.has(name)) {
      throw new NotFoundError(name);
    }
    this.#database
      .delete(schema.command)
      .where(eq(schema.command.name, name))
      .run();
    this.#commands.delete(name);
  }

  toTelegramCommands(): readonly CommandRegistry.TelegramCommand[] {
    const custom = [...this.#commands.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ command: c.name, description: c.description }));
    return [...CommandRegistry.builtins, ...custom];
  }

  static create(database: Database): CommandRegistry {
    const rows = database.query.command.findMany().sync();
    const commands = new Map<string, CommandRegistry.Command>();
    for (const row of rows) {
      commands.set(row.name, {
        name: row.name,
        description: row.description,
        prompt: row.prompt,
      });
    }
    return new CommandRegistry(database, commands);
  }
}

export namespace CommandRegistry {
  export interface Command {
    readonly name: string;
    readonly description: string;
    readonly prompt: string;
  }

  export interface TelegramCommand {
    readonly command: string;
    readonly description: string;
  }

  export interface CreateInput {
    readonly name: string;
    readonly description: string;
    readonly prompt: string;
  }

  export interface UpdateInput {
    readonly name: string;
    readonly description?: string | undefined;
    readonly prompt?: string | undefined;
  }
}
