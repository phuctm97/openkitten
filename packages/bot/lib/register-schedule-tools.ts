import type { McpServer as Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JobOptions } from "bunqueue/client";
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
        "Always call queue_server_time first to know the current server time before computing the expression.",
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
      "The scheduled task ID. Use queue_schedule_list to find task IDs first.",
    ),
});

const scheduleUpdateInputSchema = zod.looseObject({
  id: zod
    .string()
    .trim()
    .min(1)
    .describe(
      "The scheduled task ID to update. Use queue_schedule_list to find task IDs first.",
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
    "queue_schedule_create",
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
    "queue_schedule_list",
    {
      description:
        "List all scheduled tasks with their IDs, prompts, cron expressions, and next run times. Use this to find task IDs before calling queue_schedule_update, queue_schedule_delete, or queue_schedule_trigger.",
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
    "queue_schedule_delete",
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
    "queue_schedule_trigger",
    {
      description:
        "Enqueue a scheduled task for immediate execution without waiting for the next cron tick. The job is processed asynchronously — for background tasks, execution may take several minutes as the AI processes the prompt. Use queue_status or queue_list_jobs to monitor progress.",
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
    "queue_schedule_update",
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
    "queue_server_time",
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

  // -------------------------------------------------------------------------
  // Queue tools — expose bunqueue capabilities to the agent
  // -------------------------------------------------------------------------

  server.registerTool(
    "queue_add_job",
    {
      description:
        "Queue a one-off job for immediate or delayed execution via bunqueue queue.add(). Accepts all bunqueue JobOptions. Returns the full bunqueue Job.",
      inputSchema: zod.looseObject({
        kind: taskKindSchema
          .default("session")
          .describe(
            'Execution mode: "session" responds in chat, "background" runs silently.',
          ),
        description: zod
          .string()
          .trim()
          .min(1)
          .describe("Short label for this job."),
        prompt: zod
          .string()
          .trim()
          .min(1)
          .describe("The instruction the AI agent will execute."),
        priority: zod
          .number()
          .int()
          .optional()
          .describe("Job priority. Higher = processed sooner."),
        delay: zod
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Delay in ms before job becomes available."),
        attempts: zod
          .number()
          .int()
          .optional()
          .describe("Maximum number of retry attempts."),
        backoff: zod
          .union([
            zod.number(),
            zod.object({
              type: zod.enum(["fixed", "exponential"]),
              delay: zod.number(),
            }),
          ])
          .optional()
          .describe("Backoff delay or config between retries."),
        timeout: zod
          .number()
          .int()
          .optional()
          .describe("Processing timeout in ms."),
        jobId: zod
          .string()
          .optional()
          .describe("Custom job ID for idempotent/deduplication."),
        removeOnComplete: zod
          .union([zod.boolean(), zod.number()])
          .optional()
          .describe(
            "Remove job on completion (true, false, or max age in ms).",
          ),
        removeOnFail: zod
          .union([zod.boolean(), zod.number()])
          .optional()
          .describe("Remove job on failure (true, false, or max age in ms)."),
        lifo: zod
          .boolean()
          .optional()
          .describe("Process in LIFO order (newest first)."),
        stallTimeout: zod
          .number()
          .int()
          .optional()
          .describe("Stall timeout in ms."),
        durable: zod
          .boolean()
          .optional()
          .describe("Force immediate persistence to disk."),
      }),
    },
    async (args) => {
      const metadata = ctx.getMetadata(args);
      const opts: JobOptions = {};
      if (args.priority !== undefined) opts.priority = args.priority;
      if (args.delay !== undefined) opts.delay = args.delay;
      if (args.attempts !== undefined) opts.attempts = args.attempts;
      if (args.backoff !== undefined) opts.backoff = args.backoff;
      if (args.timeout !== undefined) opts.timeout = args.timeout;
      if (args.jobId !== undefined) opts.jobId = args.jobId;
      if (args.removeOnComplete !== undefined)
        opts.removeOnComplete = args.removeOnComplete;
      if (args.removeOnFail !== undefined)
        opts.removeOnFail = args.removeOnFail;
      if (args.lifo !== undefined) opts.lifo = args.lifo;
      if (args.stallTimeout !== undefined)
        opts.stallTimeout = args.stallTimeout;
      if (args.durable !== undefined) opts.durable = args.durable;
      const job = await ctx.scheduler.addJob(
        metadata.sessionID,
        args.kind ?? "session",
        args.description,
        args.prompt,
        Object.keys(opts).length > 0 ? opts : undefined,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(job.toJSON(), null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "queue_status",
    {
      description:
        "Get current queue status via bunqueue getJobCountsAsync() and isPaused(). Returns full JobCounts.",
      inputSchema: zod.looseObject({}),
    },
    async (args) => {
      ctx.getMetadata(args);
      const queue = ctx.scheduler.bunqueue;
      const counts = await queue.getJobCountsAsync();
      const paused = queue.isPaused();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ paused, counts }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "queue_pause",
    {
      description: "Pause the job queue via bunqueue pause().",
      inputSchema: zod.looseObject({}),
    },
    async (args) => {
      ctx.getMetadata(args);
      ctx.scheduler.bunqueue.pause();
      return {
        content: [{ type: "text", text: "Queue paused." }],
      };
    },
  );

  server.registerTool(
    "queue_resume",
    {
      description: "Resume the job queue via bunqueue resume().",
      inputSchema: zod.looseObject({}),
    },
    async (args) => {
      ctx.getMetadata(args);
      ctx.scheduler.bunqueue.resume();
      return {
        content: [{ type: "text", text: "Queue resumed." }],
      };
    },
  );

  server.registerTool(
    "queue_cancel_job",
    {
      description: "Cancel a job via bunqueue cancel(jobId, gracePeriodMs?).",
      inputSchema: zod.looseObject({
        jobId: zod.string().trim().min(1).describe("The job ID to cancel."),
        gracePeriodMs: zod
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Grace period in ms before cancellation."),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      ctx.scheduler.bunqueue.cancel(args.jobId, args.gracePeriodMs);
      return {
        content: [
          {
            type: "text",
            text: `Cancellation requested for job ${args.jobId}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "queue_get_job",
    {
      description:
        "Get a job by ID via bunqueue getJob(). Returns the full bunqueue Job as JSON (toJSON()).",
      inputSchema: zod.looseObject({
        jobId: zod.string().trim().min(1).describe("The job ID to look up."),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const job = await ctx.scheduler.bunqueue.getJob(args.jobId);
      if (!job) {
        return {
          content: [{ type: "text", text: `Job ${args.jobId} not found.` }],
        };
      }
      const state = await job.getState();
      const json = job.toJSON();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ...json, state }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "queue_list_crons",
    {
      description:
        "List all active cron schedulers via bunqueue listCrons(). Returns full SchedulerInfo[].",
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

  server.registerTool(
    "queue_dlq_list",
    {
      description:
        "List dead-lettered jobs via bunqueue getDlq(filter?) and getDlqStats(). Returns full DlqStats and DlqEntry[] (including attempts array, retryCount, lastRetryAt, nextRetryAt, expiresAt).",
      inputSchema: zod.looseObject({
        reason: zod
          .enum([
            "explicit_fail",
            "max_attempts_exceeded",
            "timeout",
            "stalled",
            "ttl_expired",
            "worker_lost",
            "unknown",
          ])
          .optional()
          .describe("Filter by failure reason."),
        olderThan: zod
          .number()
          .optional()
          .describe("Filter entries older than this timestamp."),
        newerThan: zod
          .number()
          .optional()
          .describe("Filter entries newer than this timestamp."),
        retriable: zod
          .boolean()
          .optional()
          .describe("Filter by retriable status."),
        expired: zod.boolean().optional().describe("Filter by expired status."),
        limit: zod.number().int().optional().describe("Max entries to return."),
        offset: zod
          .number()
          .int()
          .optional()
          .describe("Offset for pagination."),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const queue = ctx.scheduler.bunqueue;
      const stats = queue.getDlqStats();
      const filter = {
        ...(args.reason !== undefined && { reason: args.reason }),
        ...(args.olderThan !== undefined && { olderThan: args.olderThan }),
        ...(args.newerThan !== undefined && { newerThan: args.newerThan }),
        ...(args.retriable !== undefined && { retriable: args.retriable }),
        ...(args.expired !== undefined && { expired: args.expired }),
        ...(args.limit !== undefined && { limit: args.limit }),
        ...(args.offset !== undefined && { offset: args.offset }),
      };
      const entries =
        Object.keys(filter).length > 0 ? queue.getDlq(filter) : queue.getDlq();
      const serializedEntries = entries.map((entry) => ({
        ...entry,
        job: entry.job.toJSON(),
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { stats, entries: serializedEntries },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "queue_dlq_retry",
    {
      description:
        "Retry dead-lettered jobs via bunqueue retryDlq(id?). Returns count of retried entries.",
      inputSchema: zod.looseObject({
        id: zod
          .string()
          .trim()
          .optional()
          .describe("DLQ entry ID to retry. Omit to retry all."),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const retried = ctx.scheduler.bunqueue.retryDlq(args.id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ retried }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "queue_dlq_purge",
    {
      description:
        "Purge all dead-lettered jobs via bunqueue purgeDlq(). Returns count of purged entries.",
      inputSchema: zod.looseObject({}),
    },
    async (args) => {
      ctx.getMetadata(args);
      const purged = ctx.scheduler.bunqueue.purgeDlq();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ purged }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "queue_list_jobs",
    {
      description:
        "List jobs by state via bunqueue queue.getJobsAsync(). Returns full Job[] as JSON.",
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
          .optional()
          .describe("Filter by job state. Omit for all states."),
        start: zod
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Start index for pagination."),
        end: zod
          .number()
          .int()
          .optional()
          .describe("End index for pagination."),
        asc: zod
          .boolean()
          .optional()
          .describe("Sort ascending by creation time."),
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
    "queue_remove_job",
    {
      description:
        "Remove a specific job from the queue via bunqueue queue.removeAsync().",
      inputSchema: zod.looseObject({
        jobId: zod.string().trim().min(1).describe("The job ID to remove."),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      await ctx.scheduler.bunqueue.queue.removeAsync(args.jobId);
      return {
        content: [{ type: "text", text: `Removed job ${args.jobId}.` }],
      };
    },
  );

  server.registerTool(
    "queue_retry_job",
    {
      description: "Retry a specific failed job via bunqueue queue.retryJob().",
      inputSchema: zod.looseObject({
        jobId: zod.string().trim().min(1).describe("The job ID to retry."),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      await ctx.scheduler.bunqueue.queue.retryJob(args.jobId);
      return {
        content: [{ type: "text", text: `Retried job ${args.jobId}.` }],
      };
    },
  );

  server.registerTool(
    "queue_clean",
    {
      description:
        "Clean up old jobs by state via bunqueue queue.cleanAsync(). Returns array of removed job IDs.",
      inputSchema: zod.looseObject({
        grace: zod
          .number()
          .int()
          .min(0)
          .describe(
            "Grace period in ms — only jobs older than this are removed.",
          ),
        limit: zod
          .number()
          .int()
          .min(1)
          .describe("Maximum number of jobs to remove."),
        state: zod
          .enum(["completed", "failed", "delayed", "waiting", "active"])
          .optional()
          .describe("Job state to clean. Defaults to completed."),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      const removed = await ctx.scheduler.bunqueue.queue.cleanAsync(
        args.grace,
        args.limit,
        args.state,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ removed }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "queue_promote_job",
    {
      description:
        "Promote a delayed job to waiting state via bunqueue queue.promoteJob().",
      inputSchema: zod.looseObject({
        jobId: zod
          .string()
          .trim()
          .min(1)
          .describe("The delayed job ID to promote."),
      }),
    },
    async (args) => {
      ctx.getMetadata(args);
      await ctx.scheduler.bunqueue.queue.promoteJob(args.jobId);
      return {
        content: [{ type: "text", text: `Promoted job ${args.jobId}.` }],
      };
    },
  );
}
