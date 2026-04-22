import type { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import zod from "zod";
import type { Scheduler } from "~/lib/scheduler";

const overlapSchema = zod.enum(["queue", "skip", "cancel_previous"]);

const runStatusSchema = zod.enum([
  "pending",
  "running",
  "reported",
  "silent",
  "failed",
  "cancelled",
  "skipped",
]);

const runTriggerSchema = zod.enum(["cron", "manual"]);

const scheduleTaskSchema = zod.object({
  id: zod.string(),
  sessionId: zod.string(),
  description: zod.string(),
  prompt: zod.string(),
  cron: zod.string(),
  timezone: zod.string(),
  once: zod.boolean(),
  enabled: zod.boolean(),
  overlap: overlapSchema,
  notifyOnFailure: zod.boolean(),
  maxRuntimeMs: zod.number().nullable(),
  createdAt: zod.number(),
  updatedAt: zod.number(),
});

const runRecordSchema = zod.object({
  id: zod.string(),
  scheduleId: zod.string(),
  sessionId: zod.string(),
  queueJobId: zod.string().nullable(),
  trigger: runTriggerSchema,
  status: runStatusSchema,
  startedAt: zod.number(),
  finishedAt: zod.number().nullable(),
  output: zod.string().nullable(),
  error: zod.string().nullable(),
});

const scheduleCreateInputSchema = zod.looseObject({
  cron: zod
    .string()
    .trim()
    .min(1)
    .describe(
      [
        "Cron expression (5-field: minute hour dom month dow).",
        "Examples: '0 9 * * *' (daily 9am), '*/30 * * * *' (every 30min), '0 0 * * 1' (Monday midnight).",
        "Shortcuts: @hourly, @daily, @weekly, @monthly.",
        "Interpreted in the schedule's timezone (default UTC). Always call queue_server_time first to compute the correct expression.",
      ].join(" "),
    ),
  description: zod
    .string()
    .trim()
    .min(1)
    .describe(
      "Short human-readable label shown when listing schedules. Example: 'Daily standup summary', 'Hourly server health check'.",
    ),
  prompt: zod
    .string()
    .trim()
    .min(1)
    .describe(
      [
        "The instruction the AI agent will execute each time the schedule fires.",
        "Runs in a fresh ephemeral session — write as a self-contained instruction.",
        "If the task finds nothing worth reporting, it stays silent: no Telegram message, no session noise — only a 'silent' run record for history tracing.",
        "Describe the check or query, e.g. 'Check if any bank transaction emails arrived since the last run. If any, list them concisely with amount/merchant. If none, do not report anything.'",
      ].join(" "),
    ),
  once: zod
    .boolean()
    .optional()
    .describe(
      "If true, fires once at the next matching cron time, then auto-disables (row preserved for history). Default: false (recurring).",
    ),
  timezone: zod
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "IANA timezone for interpreting the cron expression (e.g. 'Asia/Ho_Chi_Minh', 'Europe/London'). Default: 'UTC'.",
    ),
  overlap: overlapSchema
    .optional()
    .describe(
      [
        "Behavior when a cron tick fires while a previous run is still executing.",
        "'queue' (default): let the new run stack behind the active one.",
        "'skip': drop the new tick and record a 'skipped' run.",
        "'cancel_previous': abort the active run and start the new one.",
      ].join(" "),
    ),
  notifyOnFailure: zod
    .boolean()
    .optional()
    .describe(
      "When true, delivers a Telegram message on execution failure. Default false (failures are silent but recorded in queue_runs).",
    ),
  maxRuntimeMs: zod
    .number()
    .int()
    .min(1000)
    .optional()
    .describe(
      "Maximum time in milliseconds the ephemeral session is allowed to run before the run is finalized as silent. Default: 900000 (15 minutes).",
    ),
});

const scheduleIdInputSchema = zod.looseObject({
  id: zod
    .string()
    .trim()
    .uuid()
    .describe(
      "The scheduled task UUID. Use queue_schedule_list to find task IDs. Must be a plain UUID.",
    ),
});

const scheduleUpdateInputSchema = zod.looseObject({
  id: zod.string().trim().uuid().describe("The scheduled task UUID to update."),
  description: zod.string().trim().min(1).optional(),
  prompt: zod.string().trim().min(1).optional(),
  cron: zod.string().trim().min(1).optional(),
  timezone: zod.string().trim().min(1).optional(),
  overlap: overlapSchema.optional(),
  notifyOnFailure: zod.boolean().optional(),
  maxRuntimeMs: zod.number().int().min(1000).nullable().optional(),
});

const scheduleListInputSchema = zod.looseObject({
  sessionId: zod.string().trim().min(1).optional(),
  enabled: zod.boolean().optional(),
});

const runListInputSchema = zod.looseObject({
  scheduleId: zod.string().trim().uuid().optional(),
  sessionId: zod.string().trim().min(1).optional(),
  status: runStatusSchema.optional(),
  trigger: runTriggerSchema.optional(),
  since: zod.number().int().min(0).optional(),
  until: zod.number().int().min(0).optional(),
  limit: zod.number().int().min(1).max(500).optional(),
  offset: zod.number().int().min(0).optional(),
});

const runIdInputSchema = zod.looseObject({
  id: zod.string().trim().uuid().describe("The scheduled run UUID."),
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
    "queue_server_time",
    {
      description:
        "Get the current server time in multiple formats. Call this before creating or updating scheduled tasks to compute correct cron expressions in the desired timezone.",
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

  server.registerTool(
    "queue_schedule_create",
    {
      description:
        "Create a scheduled task. Runs in an ephemeral OpenCode session on each cron tick. If the run produces meaningful output, it's delivered to the user's Telegram chat. If the instruction finds nothing worth reporting, the run stays silent in both the chat and the session — only a 'silent' run record is kept for history tracing via queue_runs.",
      inputSchema: scheduleCreateInputSchema,
      outputSchema: scheduleTaskSchema,
    },
    async (args) => {
      const metadata = ctx.getMetadata(args);
      const task = await ctx.scheduler.create({
        sessionId: metadata.sessionID,
        cron: args.cron,
        description: args.description,
        prompt: args.prompt,
        once: args.once ?? false,
        ...(args.timezone !== undefined && { timezone: args.timezone }),
        ...(args.overlap !== undefined && { overlap: args.overlap }),
        ...(args.notifyOnFailure !== undefined && {
          notifyOnFailure: args.notifyOnFailure,
        }),
        ...(args.maxRuntimeMs !== undefined && {
          maxRuntimeMs: args.maxRuntimeMs,
        }),
      });
      return {
        content: [
          {
            type: "text",
            text: `Created schedule [${task.id}]: "${task.description}" (cron: ${task.cron} ${task.timezone}${task.once ? ", once" : ""})`,
          },
        ],
        structuredContent: { ...task },
      };
    },
  );

  server.registerTool(
    "queue_schedule_list",
    {
      description:
        "List scheduled tasks with optional filters. Use this to find task IDs before calling queue_schedule_update, queue_schedule_delete, queue_schedule_trigger, queue_schedule_enable, or queue_schedule_disable.",
      inputSchema: scheduleListInputSchema,
      outputSchema: zod.object({ tasks: zod.array(scheduleTaskSchema) }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const filter: Scheduler.ListFilter = {
        ...(args.sessionId !== undefined && { sessionId: args.sessionId }),
        ...(args.enabled !== undefined && { enabled: args.enabled }),
      };
      const tasks = ctx.scheduler.list(filter);
      const lines = tasks.map(
        (t) =>
          `- [${t.id}] ${t.enabled ? "▶" : "⏸"} "${t.description}" | cron: ${t.cron} ${t.timezone}${t.once ? " (once)" : ""} | overlap: ${t.overlap}${t.notifyOnFailure ? " | notifyOnFailure" : ""}`,
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
    "queue_schedule_update",
    {
      description:
        "Update fields on an existing scheduled task. Omitted fields keep their current values. If cron or timezone changes, the schedule re-registers immediately.",
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
        ...(args.timezone !== undefined && { timezone: args.timezone }),
        ...(args.overlap !== undefined && { overlap: args.overlap }),
        ...(args.notifyOnFailure !== undefined && {
          notifyOnFailure: args.notifyOnFailure,
        }),
        ...(args.maxRuntimeMs !== undefined && {
          maxRuntimeMs: args.maxRuntimeMs,
        }),
      });
      return {
        content: [
          {
            type: "text",
            text: `Updated schedule [${task.id}]: "${task.description}"`,
          },
        ],
        structuredContent: { ...task },
      };
    },
  );

  server.registerTool(
    "queue_schedule_delete",
    {
      description:
        "Permanently delete a scheduled task and all its run history. Any in-flight run is cancelled. Use queue_schedule_disable to pause without losing history.",
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
    "queue_schedule_enable",
    {
      description:
        "Re-enable a previously disabled schedule. The cron is re-registered and firing resumes at the next matching time.",
      inputSchema: scheduleIdInputSchema,
      outputSchema: scheduleTaskSchema,
    },
    async (args) => {
      ctx.getMetadata(args);
      const task = await ctx.scheduler.enable(args.id);
      return {
        content: [{ type: "text", text: `Enabled schedule ${task.id}.` }],
        structuredContent: { ...task },
      };
    },
  );

  server.registerTool(
    "queue_schedule_disable",
    {
      description:
        "Pause a schedule without deleting it. The cron is removed from the queue and no new runs fire until queue_schedule_enable is called. Existing run history is preserved.",
      inputSchema: scheduleIdInputSchema,
      outputSchema: scheduleTaskSchema,
    },
    async (args) => {
      ctx.getMetadata(args);
      const task = await ctx.scheduler.disable(args.id);
      return {
        content: [{ type: "text", text: `Disabled schedule ${task.id}.` }],
        structuredContent: { ...task },
      };
    },
  );

  server.registerTool(
    "queue_schedule_trigger",
    {
      description:
        "Enqueue a scheduled task for immediate execution without waiting for the next cron tick. Returns the run id (pre-created with status 'pending', transitions to 'running' when the worker picks it up). Use queue_run_get with the returned run id to poll the result.",
      inputSchema: scheduleIdInputSchema,
      outputSchema: zod.object({
        scheduleId: zod.string(),
        runId: zod.string(),
        queueJobId: zod.string(),
        enqueuedAt: zod.number(),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const result = await ctx.scheduler.trigger(args.id);
      return {
        content: [
          {
            type: "text",
            text: `Triggered schedule ${result.scheduleId} → run ${result.runId} (job ${result.queueJobId})`,
          },
        ],
        structuredContent: { ...result },
      };
    },
  );

  server.registerTool(
    "queue_runs",
    {
      description:
        "List scheduled run records with optional filters. Each run has its own UUID, a status (pending, running, reported, silent, failed, cancelled, skipped), and either output text (on 'reported') or error text (on 'failed'). Use this to trace what scheduled tasks have done, even across bot restarts.",
      inputSchema: runListInputSchema,
      outputSchema: zod.object({ runs: zod.array(runRecordSchema) }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const runs = ctx.scheduler.listRuns({
        ...(args.scheduleId !== undefined && { scheduleId: args.scheduleId }),
        ...(args.sessionId !== undefined && { sessionId: args.sessionId }),
        ...(args.status !== undefined && { status: args.status }),
        ...(args.trigger !== undefined && { trigger: args.trigger }),
        ...(args.since !== undefined && { since: args.since }),
        ...(args.until !== undefined && { until: args.until }),
        ...(args.limit !== undefined && { limit: args.limit }),
        ...(args.offset !== undefined && { offset: args.offset }),
      });
      const text =
        runs.length === 0
          ? "No matching runs."
          : `${runs.length} run(s):\n${runs
              .map(
                (r) =>
                  `- [${r.id}] ${r.status} (${r.trigger}) schedule=${r.scheduleId} ${new Date(r.startedAt).toISOString()}${r.finishedAt ? ` → ${new Date(r.finishedAt).toISOString()} (${r.finishedAt - r.startedAt}ms)` : " running"}${r.output ? ` | output: ${r.output.slice(0, 200)}` : ""}${r.error ? ` | error: ${r.error}` : ""}`,
              )
              .join("\n")}`;
      return {
        content: [{ type: "text", text }],
        structuredContent: { runs: runs.map((r) => ({ ...r })) },
      };
    },
  );

  server.registerTool(
    "queue_run_get",
    {
      description:
        "Fetch full details of a single scheduled run by its UUID, including the complete output or error text.",
      inputSchema: runIdInputSchema,
      outputSchema: runRecordSchema,
    },
    async (args) => {
      ctx.getMetadata(args);
      const run = ctx.scheduler.getRun(args.id);
      return {
        content: [
          {
            type: "text",
            text: `Run ${run.id}: ${run.status} (${run.trigger})${run.output ? `\nOutput:\n${run.output}` : ""}${run.error ? `\nError: ${run.error}` : ""}`,
          },
        ],
        structuredContent: { ...run },
      };
    },
  );

  server.registerTool(
    "queue_run_cancel",
    {
      description:
        "Cancel an in-flight scheduled run. The ephemeral session is aborted and the run is recorded as 'cancelled'. Only works on runs in 'pending' or 'running' status.",
      inputSchema: runIdInputSchema,
      outputSchema: runRecordSchema,
    },
    async (args) => {
      ctx.getMetadata(args);
      const run = await ctx.scheduler.cancelRun(args.id);
      return {
        content: [{ type: "text", text: `Cancelled run ${run.id}.` }],
        structuredContent: { ...run },
      };
    },
  );

  server.registerTool(
    "queue_status",
    {
      description:
        "Get current bunqueue job-queue status: paused/running state and JobCounts by state.",
      inputSchema: zod.looseObject({}),
    },
    async (args) => {
      ctx.getMetadata(args);
      const queue = ctx.scheduler.bunqueue;
      const counts = await queue.getJobCountsAsync();
      const paused = queue.isPaused();
      return {
        content: [
          { type: "text", text: JSON.stringify({ paused, counts }, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "queue_list_jobs",
    {
      description:
        "List raw bunqueue jobs by state. Returns full Job JSON — useful for low-level debugging when queue_runs doesn't show what you expect.",
      inputSchema: zod.looseObject({
        state: zod
          .enum([
            "waiting",
            "active",
            "completed",
            "failed",
            "delayed",
            "prioritized",
          ])
          .optional(),
        start: zod.number().int().min(0).optional(),
        end: zod.number().int().optional(),
        asc: zod.boolean().optional(),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const opts = {
        ...(args.state !== undefined && { state: args.state }),
        ...(args.start !== undefined && { start: args.start }),
        ...(args.end !== undefined && { end: args.end }),
        ...(args.asc !== undefined && { asc: args.asc }),
      };
      const jobs = await ctx.scheduler.bunqueue.queue.getJobsAsync(opts);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              jobs.map((j) => j.toJSON()),
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "queue_list_crons",
    {
      description:
        "List active bunqueue cron schedulers. Useful to confirm that schedules are actually registered with the queue engine.",
      inputSchema: zod.looseObject({}),
    },
    async (args) => {
      ctx.getMetadata(args);
      const crons = await ctx.scheduler.bunqueue.listCrons();
      return {
        content: [{ type: "text", text: JSON.stringify(crons, null, 2) }],
      };
    },
  );
}
