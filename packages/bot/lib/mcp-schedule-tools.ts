import type { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import zod from "zod";
import type { ExistingSessions } from "~/lib/existing-sessions";
import type { Scheduler } from "~/lib/scheduler";

const taskTypeSchema = zod.enum(["message", "prompt"]);

const scheduleTaskSchema = zod.object({
  id: zod.string(),
  type: taskTypeSchema,
  cron: zod.string(),
  description: zod.string(),
  prompt: zod.string(),
  paused: zod.boolean(),
  once: zod.boolean(),
  nextRun: zod.string().nullable(),
});

const scheduleCreateInputSchema = zod.looseObject({
  type: taskTypeSchema
    .default("message")
    .describe(
      'Task type: "message" sends the text directly to Telegram (for reminders, alerts, greetings). "prompt" sends the text to the AI agent for processing (for summaries, reports, analysis). Default: "message".',
    ),
  cron: zod
    .string()
    .trim()
    .min(1)
    .describe(
      "Cron expression in UTC (5-field: minute hour dom month dow). Supports @hourly, @daily, @weekly, @monthly. Use get_server_time to know current time.",
    ),
  description: zod
    .string()
    .trim()
    .min(1)
    .describe("Short human-readable description of this scheduled task."),
  prompt: zod
    .string()
    .trim()
    .min(1)
    .describe(
      'For type "message": the exact text to send. For type "prompt": the instruction for the AI agent.',
    ),
  once: zod
    .boolean()
    .optional()
    .describe(
      "If true, the task fires once then the schedule is removed (the delivered message remains). Default: false (recurring).",
    ),
});

const scheduleListInputSchema = zod.looseObject({});

const scheduleIdInputSchema = zod.looseObject({
  id: zod.string().trim().min(1).describe("The scheduled task ID."),
});

interface McpScheduleContext {
  readonly scheduler: Scheduler;
  readonly existingSessions: ExistingSessions;
  readonly getMetadata: (args: unknown) => { sessionID: string };
}

export function registerScheduleTools(
  server: Server,
  ctx: McpScheduleContext,
): void {
  server.registerTool(
    "schedule_create",
    {
      description:
        'Create a scheduled task. type "message" sends text directly to Telegram. type "prompt" sends to AI for processing.',
      inputSchema: scheduleCreateInputSchema,
      outputSchema: scheduleTaskSchema,
    },
    async (args) => {
      const metadata = ctx.getMetadata(args);
      const location = ctx.existingSessions.get(metadata.sessionID);
      if (!location)
        throw new Error(`Session not found: ${metadata.sessionID}`);
      const task = await ctx.scheduler.create({
        type: args.type ?? "message",
        chatId: location.chatId,
        threadId: location.threadId,
        cron: args.cron,
        description: args.description,
        prompt: args.prompt,
        once: args.once ?? false,
      });
      return {
        content: [
          { type: "text", text: `Created schedule: ${task.description}` },
        ],
        structuredContent: { ...task },
      };
    },
  );

  server.registerTool(
    "schedule_list",
    {
      description: "List all scheduled tasks.",
      inputSchema: scheduleListInputSchema,
      outputSchema: zod.object({
        tasks: zod.array(scheduleTaskSchema),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const tasks = await ctx.scheduler.list();
      return {
        content: [
          { type: "text", text: `Found ${tasks.length} scheduled task(s).` },
        ],
        structuredContent: { tasks: tasks.map((t) => ({ ...t })) },
      };
    },
  );

  server.registerTool(
    "schedule_delete",
    {
      description: "Delete a scheduled task by ID.",
      inputSchema: scheduleIdInputSchema,
      outputSchema: zod.object({ deleted: zod.boolean() }),
    },
    async (args) => {
      ctx.getMetadata(args);
      await ctx.scheduler.delete(args.id);
      return {
        content: [{ type: "text", text: `Deleted schedule ${args.id}.` }],
        structuredContent: { deleted: true },
      };
    },
  );

  server.registerTool(
    "schedule_trigger",
    {
      description:
        "Run a scheduled task immediately without waiting for the next cron tick.",
      inputSchema: scheduleIdInputSchema,
      outputSchema: zod.object({ triggered: zod.boolean() }),
    },
    async (args) => {
      ctx.getMetadata(args);
      await ctx.scheduler.trigger(args.id);
      return {
        content: [{ type: "text", text: `Triggered schedule ${args.id}.` }],
        structuredContent: { triggered: true },
      };
    },
  );

  server.registerTool(
    "get_server_time",
    {
      description:
        "Get the current server time. Use this before creating scheduled tasks to compute correct cron expressions.",
      inputSchema: zod.looseObject({}),
      outputSchema: zod.object({
        iso: zod.string(),
        unix: zod.number(),
        utc: zod.string(),
        timezone: zod.string(),
        offset: zod.number(),
      }),
    },
    async () => {
      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -now.getTimezoneOffset();
      const result = {
        iso: now.toISOString(),
        unix: now.getTime(),
        utc: now.toUTCString(),
        timezone,
        offset,
      };
      return {
        content: [
          { type: "text", text: `Server time: ${result.utc} (${timezone})` },
        ],
        structuredContent: result,
      };
    },
  );
}
