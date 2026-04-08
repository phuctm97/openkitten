import type { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import zod from "zod";
import type { Scheduler } from "~/lib/scheduler";

const taskKindSchema = zod.enum(["session", "background"]);

const scheduleTaskSchema = zod.object({
  id: zod.string(),
  sessionId: zod.string(),
  kind: taskKindSchema,
  cron: zod.string(),
  description: zod.string(),
  prompt: zod.string(),
  once: zod.boolean(),
  nextRun: zod.string().nullable(),
});

const scheduleCreateInputSchema = zod.looseObject({
  kind: taskKindSchema
    .default("session")
    .describe(
      [
        'Task execution mode. "session" executes the prompt inside the current Telegram chat — the AI response appears in the conversation just like a normal message, and the chat history is preserved across runs.',
        '"background" executes the prompt in an isolated session and only sends a Telegram message when the AI determines there is meaningful data to report. Use "background" for monitoring, alerts, and silent periodic checks.',
        'Default: "session".',
      ].join(" "),
    ),
  cron: zod
    .string()
    .trim()
    .min(1)
    .describe(
      [
        "Cron expression in UTC (5-field: minute hour dom month dow).",
        "Examples: '0 9 * * *' (daily 9am), '*/30 * * * *' (every 30min), '0 0 * * 1' (Monday midnight).",
        "Shortcuts: @hourly, @daily, @weekly, @monthly.",
        "Always call get_server_time first to know the current server time before computing the expression.",
      ].join(" "),
    ),
  description: zod
    .string()
    .trim()
    .min(1)
    .describe(
      "Short human-readable label for this task, shown when listing schedules. Example: 'Daily standup summary', 'Hourly server health check'.",
    ),
  prompt: zod
    .string()
    .trim()
    .min(1)
    .describe(
      [
        "The instruction the AI agent will execute each time the schedule fires.",
        "Write this as a self-contained instruction — it runs in a separate context from this conversation.",
        'For "session" kind: write it like a message the user would send, e.g. "Summarize what happened today".',
        'For "background" kind: write it as a check or query, e.g. "Check if the deployment pipeline has any failures". The AI will decide whether the result is worth reporting.',
      ].join(" "),
    ),
  once: zod
    .boolean()
    .optional()
    .describe(
      "If true, the task fires once at the next matching cron time, then auto-deletes. Use for one-time reminders. Default: false (recurring).",
    ),
});

const scheduleListInputSchema = zod.looseObject({});

const scheduleIdInputSchema = zod.looseObject({
  id: zod
    .string()
    .trim()
    .min(1)
    .describe(
      "The scheduled task ID. Use schedule_list to find task IDs first.",
    ),
});

const scheduleUpdateInputSchema = zod.looseObject({
  id: zod
    .string()
    .trim()
    .min(1)
    .describe(
      "The scheduled task ID to update. Use schedule_list to find task IDs first.",
    ),
  description: zod
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("New human-readable label for the task."),
  prompt: zod
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("New instruction the AI agent will execute on schedule."),
  cron: zod
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "New cron expression in UTC. The schedule restarts immediately with the new timing.",
    ),
});

interface ScheduleToolsContext {
  readonly scheduler: Scheduler;
  readonly getMetadata: (args: unknown) => { sessionID: string };
}

export function registerScheduleTools(
  server: Server,
  ctx: ScheduleToolsContext,
): void {
  server.registerTool(
    "schedule_create",
    {
      description:
        'Create a scheduled task that runs on a cron schedule. Use kind "session" for tasks that respond in the chat (reminders, summaries, recurring analysis). Use kind "background" for silent monitoring that only notifies the user when something noteworthy is found.',
      inputSchema: scheduleCreateInputSchema,
      outputSchema: scheduleTaskSchema,
    },
    async (args) => {
      const metadata = ctx.getMetadata(args);
      const task = await ctx.scheduler.create({
        sessionId: metadata.sessionID,
        kind: args.kind ?? "session",
        cron: args.cron,
        description: args.description,
        prompt: args.prompt,
        once: args.once ?? false,
      });
      return {
        content: [
          {
            type: "text",
            text: `Created schedule [${task.id}]: "${task.description}" (${task.kind}, cron: ${task.cron}, next: ${task.nextRun ?? "N/A"})`,
          },
        ],
        structuredContent: { ...task },
      };
    },
  );

  server.registerTool(
    "schedule_list",
    {
      description:
        "List all scheduled tasks with their IDs, prompts, cron expressions, and next run times. Use this to find task IDs before calling schedule_update, schedule_delete, or schedule_trigger.",
      inputSchema: scheduleListInputSchema,
      outputSchema: zod.object({
        tasks: zod.array(scheduleTaskSchema),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const tasks = ctx.scheduler.list();
      const lines = tasks.map(
        (t) =>
          `- [${t.id}] (${t.kind}) "${t.description}" | cron: ${t.cron} | prompt: ${t.prompt} | next: ${t.nextRun ?? "N/A"}`,
      );
      const text =
        tasks.length === 0
          ? "No scheduled tasks."
          : `${tasks.length} scheduled task(s):\n${lines.join("\n")}`;
      return {
        content: [{ type: "text", text }],
        structuredContent: { tasks: tasks.map((t) => ({ ...t })) },
      };
    },
  );

  server.registerTool(
    "schedule_delete",
    {
      description:
        "Permanently delete a scheduled task. The task stops running immediately.",
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
        "Run a scheduled task immediately without waiting for the next cron tick. Useful for testing or when the user wants results now.",
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
    "schedule_update",
    {
      description:
        "Update an existing scheduled task. Only the provided fields are changed — omitted fields keep their current values. If the cron expression changes, the new schedule takes effect immediately.",
      inputSchema: scheduleUpdateInputSchema,
      outputSchema: scheduleTaskSchema,
    },
    async (args) => {
      ctx.getMetadata(args);
      const task = await ctx.scheduler.update(args.id, {
        ...(args.description !== undefined && {
          description: args.description,
        }),
        ...(args.prompt !== undefined && { prompt: args.prompt }),
        ...(args.cron !== undefined && { cron: args.cron }),
      });
      return {
        content: [
          {
            type: "text",
            text: `Updated schedule [${task.id}]: "${task.description}" (cron: ${task.cron}, next: ${task.nextRun ?? "N/A"})`,
          },
        ],
        structuredContent: { ...task },
      };
    },
  );

  server.registerTool(
    "get_server_time",
    {
      description:
        "Get the current server time in multiple formats. Call this before creating or updating scheduled tasks to compute correct UTC cron expressions.",
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
