---
name: schedule-jobs
description: Create, test, debug, and maintain OpenKitten scheduled jobs using the queue schedule tools.
---

# Schedule Jobs

Use this skill when you need to create, update, inspect, trigger, debug, or clean up scheduled jobs that run through the OpenKitten queue scheduler.

This skill is specifically for these MCP tools:

- `openkitten_queue_server_time`
- `openkitten_queue_schedule_create`
- `openkitten_queue_schedule_list`
- `openkitten_queue_schedule_update`
- `openkitten_queue_schedule_delete`
- `openkitten_queue_schedule_trigger`
- `openkitten_queue_schedule_runs`
- `openkitten_queue_status`
- `openkitten_queue_list_jobs`
- `openkitten_queue_get_job`

## Core Mental Model

There are three separate layers to keep straight:

1. **Schedule definition**
   - cron
   - kind (`session` or `background`)
   - description
   - prompt

2. **Queue job execution**
   - the actual Bunqueue job that gets dispatched

3. **Schedule run record**
   - higher-level run history for a schedule
   - statuses like `running`, `completed_notified`, `completed_silent`, `failed`

Do not assume these three layers update at the same time.

## Session vs Background

### Use `kind: session` when

- the user should see the response in the main chat
- the user is expected to reply
- reply context matters
- you want conversation continuity

Examples:

- expense classification prompts
- daily review summaries
- reminders that expect a reply

### Use `kind: background` when

- the job should monitor silently
- the user only needs a notification when something noteworthy happens
- the result does not need to appear as normal conversation turns unless notified

Examples:

- background alerting
- silent monitoring
- periodic checks that often produce no report

## Prompt Wording Rules

For **session schedules**, prefer wording like:

- "Reply with ..."
- "Respond with ..."
- "Say ..."

Avoid wording like:

- "Send a message ..."
- "Send to Telegram ..."

Reason: session jobs should respond normally in-session. Wording like "send" can confuse the agent into trying direct Telegram tool flows unnecessarily.

For **background schedules**, explicitly state whether the task should:

- notify the user only when needed
- finish silently when there is nothing to report

## Cron Rules

- Cron is UTC.
- Always call `openkitten_queue_server_time` before choosing a cron expression.
- Do not schedule a one-time test too close to the current minute.
- Prefer setting a test schedule at least **2-3 minutes in the future** to avoid timing ambiguity and creation-delay misses.

## Standard Workflow for Creating a Schedule

1. Call `openkitten_queue_server_time`
2. Decide `session` vs `background`
3. Choose a UTC cron expression
4. Create the schedule with `openkitten_queue_schedule_create`
5. Confirm the returned schedule ID
6. Inspect with `openkitten_queue_schedule_list`

## Standard Workflow for Manual Testing

When testing a schedule manually:

1. Trigger with `openkitten_queue_schedule_trigger`
2. Inspect `openkitten_queue_schedule_runs`
3. Inspect `openkitten_queue_status`
4. If needed, inspect `openkitten_queue_get_job` or `openkitten_queue_list_jobs`

Look for:

- whether a run record exists
- whether it is `running`, `completed_notified`, `completed_silent`, or `failed`
- whether the user was notified
- whether output preview exists

## Standard Workflow for Auto-Fire Testing

When testing whether cron auto-fire works:

1. Get server time first
2. Create a one-time schedule 2-3 minutes in the future
3. Record the exact cron used
4. Wait until after the fire time
5. Check:
   - `openkitten_queue_schedule_runs`
   - `openkitten_queue_schedule_list`
   - `openkitten_queue_status`
   - `openkitten_queue_list_jobs`

If a schedule does not fire, report:

- server time at creation
- cron used
- schedule ID
- whether `nextRunAt` was shown
- whether any run history appeared
- whether any queue job appeared

## Reading Run State Correctly

Common interpretations:

- `completed_notified`
  - the run finished and the user was notified

- `completed_silent`
  - the run finished and intentionally produced no user-facing message

- `running` with output like `Polling... attempt X/450, session busy`
  - the job is still actively progressing, not necessarily stuck

- no execution history
  - either the schedule did not dispatch
  - or you checked before anything observable was created

## Expense-Tracking Specific Guidance

For expense jobs:

- use `session` if the user is expected to reply `chung` / `riêng`
- use compact outputs
- if no relevant new transaction emails exist, prefer a minimal response like `no new mails`
- if asking for classification, list items individually with:
  - transaction date/time
  - merchant/source
  - amount
  - a short numbered reply format

Do not narrate process steps in the user-facing output.

## Debug Checklist

If behavior looks wrong, check these in order:

1. `openkitten_queue_server_time`
2. `openkitten_queue_schedule_list`
3. `openkitten_queue_schedule_runs`
4. `openkitten_queue_status`
5. `openkitten_queue_list_jobs`
6. `openkitten_queue_get_job`

Keep causes separate:

- prompt/agent issue
- schedule creation issue
- cron registration issue
- queue dispatch issue
- run finalization issue
- delivery / session-routing issue

## Important Hygiene

- Clean up temporary test schedules after verification.
- If you create wait-helper jobs for testing, remove them too.
- When reporting issues, distinguish clearly between:
  - manual trigger problems
  - auto-fire problems
  - session-only problems
  - background-only problems

## Minimal Prompt Templates

### Session template

`Reply with exactly: <text>.`

### Background template

`Run a minimal background test. If successful, say exactly: <text>.`

### Expense session template

Describe the Gmail/Sheets comparison task, then explicitly say:

- if nothing is new, reply with exactly `no new mails`
- if classification is needed, reply only with a compact numbered list
