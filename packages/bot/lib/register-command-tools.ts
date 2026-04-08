import type { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Api } from "grammy";
import zod from "zod";
import { builtinCommands } from "~/lib/builtin-commands";
import { CommandSkills } from "~/lib/command-skills";

const commandNameSchema = zod
  .string()
  .trim()
  .regex(
    CommandSkills.namePattern,
    "Command name must start with a letter, contain only lowercase letters, digits, or underscores, and be 1-31 characters",
  );

const commandSchema = zod.object({
  name: zod.string(),
  description: zod.string(),
  prompt: zod.string(),
});

const commandCreateInputSchema = zod.looseObject({
  name: commandNameSchema.describe(
    "Unique command name (e.g. translate). Becomes /translate in Telegram.",
  ),
  description: zod
    .string()
    .trim()
    .min(1)
    .max(256)
    .describe("Short description shown in the Telegram command menu."),
  prompt: zod
    .string()
    .trim()
    .min(1)
    .describe(
      "Instruction the AI agent follows when the command is used. Write as a self-contained directive.",
    ),
});

const commandDeleteInputSchema = zod.looseObject({
  name: commandNameSchema.describe("Name of the command to delete."),
});

const commandListInputSchema = zod.looseObject({});

interface CommandToolsContext {
  readonly skillsDir: string;
  readonly botToken: string;
  readonly getMetadata: (args: unknown) => { sessionID: string };
}

async function refreshTelegramCommands(
  botToken: string,
  skillsDir: string,
): Promise<void> {
  const commands = await CommandSkills.list(skillsDir);
  await new Api(botToken).setMyCommands([
    ...builtinCommands,
    ...CommandSkills.toTelegramCommands(commands),
  ]);
}

export function registerCommandTools(
  server: Server,
  ctx: CommandToolsContext,
): void {
  server.registerTool(
    "command_create",
    {
      description:
        "Create a custom bot command. The command becomes available as /name in Telegram. Write the prompt as a self-contained instruction the AI agent follows when the command is used.",
      inputSchema: commandCreateInputSchema,
      outputSchema: commandSchema,
    },
    async (args) => {
      ctx.getMetadata(args);
      const command = await CommandSkills.create(ctx.skillsDir, {
        name: args.name,
        description: args.description,
        prompt: args.prompt,
      });
      await refreshTelegramCommands(ctx.botToken, ctx.skillsDir);
      return {
        content: [
          {
            type: "text",
            text: `Created command /${command.name}. It is now available in the Telegram command menu.`,
          },
        ],
        structuredContent: { ...command },
      };
    },
  );

  server.registerTool(
    "command_delete",
    {
      description: "Delete a custom bot command.",
      inputSchema: commandDeleteInputSchema,
      outputSchema: zod.object({ deleted: zod.boolean() }),
    },
    async (args) => {
      ctx.getMetadata(args);
      await CommandSkills.delete(ctx.skillsDir, args.name);
      await refreshTelegramCommands(ctx.botToken, ctx.skillsDir);
      return {
        content: [
          {
            type: "text",
            text: `Deleted command /${args.name}. It has been removed from the Telegram command menu.`,
          },
        ],
        structuredContent: { deleted: true },
      };
    },
  );

  server.registerTool(
    "command_list",
    {
      description: "List all custom bot commands.",
      inputSchema: commandListInputSchema,
      outputSchema: zod.object({ commands: zod.array(commandSchema) }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const commands = await CommandSkills.list(ctx.skillsDir);
      const lines = commands.map(
        (c) => `/${c.name} — ${c.description} (prompt: ${c.prompt})`,
      );
      return {
        content: [
          {
            type: "text",
            text:
              commands.length === 0
                ? "No custom commands."
                : `${commands.length} custom command(s):\n${lines.join("\n")}`,
          },
        ],
        structuredContent: { commands: commands.map((c) => ({ ...c })) },
      };
    },
  );
}
