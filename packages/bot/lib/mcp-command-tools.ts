import type { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Api } from "grammy";
import invariant from "tiny-invariant";
import zod from "zod";
import type { CommandRegistry } from "~/lib/command-registry";

const commandNameSchema = zod
  .string()
  .trim()
  .regex(
    /^[a-z0-9_]{1,32}$/,
    "Command name must be 1-32 lowercase letters, digits, or underscores",
  );

const commandSchema = zod.object({
  name: zod.string(),
  description: zod.string(),
  prompt: zod.string(),
});

const commandCreateInputSchema = zod.looseObject({
  name: commandNameSchema.describe("Unique command name (e.g. translate)."),
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
      'Prompt template sent to the AI agent when the command is used. Use {text} as placeholder for the user\'s input after the command (e.g. "Translate to English: {text}").',
    ),
});

const commandUpdateInputSchema = zod.looseObject({
  name: commandNameSchema.describe("Name of the command to update."),
  description: zod
    .string()
    .trim()
    .min(1)
    .max(256)
    .optional()
    .describe("New description."),
  prompt: zod
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("New prompt template."),
});

const commandDeleteInputSchema = zod.looseObject({
  name: commandNameSchema.describe("Name of the command to delete."),
});

const commandListInputSchema = zod.looseObject({});

interface McpCommandContext {
  readonly commandRegistry: CommandRegistry;
  readonly botToken: string;
  readonly getMetadata: (args: unknown) => { sessionID: string };
}

async function refreshTelegramCommands(ctx: McpCommandContext): Promise<void> {
  await new Api(ctx.botToken).setMyCommands([
    ...ctx.commandRegistry.toTelegramCommands(),
  ]);
}

export function registerCommandTools(
  server: Server,
  ctx: McpCommandContext,
): void {
  server.registerTool(
    "command_create",
    {
      description:
        'Create a custom bot command. The command becomes available as /name in Telegram. Use {text} in the prompt template for user input (e.g. "Translate to English: {text}").',
      inputSchema: commandCreateInputSchema,
      outputSchema: commandSchema,
    },
    async (args) => {
      ctx.getMetadata(args);
      const command = ctx.commandRegistry.create({
        name: args.name,
        description: args.description,
        prompt: args.prompt,
      });
      try {
        await refreshTelegramCommands(ctx);
      } catch (error) {
        ctx.commandRegistry.delete(command.name);
        throw error;
      }
      return {
        content: [{ type: "text", text: `Created command /${command.name}.` }],
        structuredContent: { ...command },
      };
    },
  );

  server.registerTool(
    "command_update",
    {
      description: "Update an existing custom bot command.",
      inputSchema: commandUpdateInputSchema,
      outputSchema: commandSchema,
    },
    async (args) => {
      ctx.getMetadata(args);
      const before = ctx.commandRegistry.get(args.name);
      const command = ctx.commandRegistry.update({
        name: args.name,
        description: args.description,
        prompt: args.prompt,
      });
      try {
        await refreshTelegramCommands(ctx);
      } catch (error) {
        invariant(before, "Expected command to exist before update");
        ctx.commandRegistry.update({
          name: before.name,
          description: before.description,
          prompt: before.prompt,
        });
        throw error;
      }
      return {
        content: [{ type: "text", text: `Updated command /${command.name}.` }],
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
      const before = ctx.commandRegistry.get(args.name);
      ctx.commandRegistry.delete(args.name);
      try {
        await refreshTelegramCommands(ctx);
      } catch (error) {
        invariant(before, "Expected command to exist before delete");
        ctx.commandRegistry.create(before);
        throw error;
      }
      return {
        content: [{ type: "text", text: `Deleted command /${args.name}.` }],
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
      const commands = ctx.commandRegistry.list();
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
        structuredContent: { commands: [...commands] },
      };
    },
  );
}
