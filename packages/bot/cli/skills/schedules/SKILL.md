---
name: schedules
description: Create, inspect, trigger, update, and clean up scheduled tasks. Use whenever the user asks about recurring jobs, reminders, background checks, or wants history of past runs.
---

# Scheduled Tasks

OpenKitten exposes a scheduler that fires tasks on a cron pattern. Each tick runs in a fresh ephemeral OpenCode session, produces a final text response, and is either delivered to the user (as a Telegram message) or stays silent — based on what the task itself emits.

This skill covers these MCP tools. **Use them exactly as listed** — do not invent variants:

| Tool | Purpose |
|---|---|
| `openkitten_queue_server_time` | get the current server time before choosing a cron expression |
| `openkitten_queue_schedule_create` | create a new recurring or one-time schedule |
| `openkitten_queue_schedule_list` | list schedules, optionally filtered |
| `openkitten_queue_schedule_update` | change cron / timezone / prompt / description / overlap / notifyOnFailure / maxRuntimeMs |
| `openkitten_queue_schedule_enable` | resume a paused schedule |
| `openkitten_queue_schedule_disable` | pause without deleting (history preserved) |
| `openkitten_queue_schedule_delete` | permanently remove; all runs cascade-delete |
| `openkitten_queue_schedule_trigger` | fire immediately (bypasses cron + overlap policy) |
| `openkitten_queue_runs` | list run history |
| `openkitten_queue_run_get` | fetch one run by id, with full output/error |
| `openkitten_queue_run_cancel` | abort an in-flight run |

Low-level diagnostic tools (`openkitten_queue_status`, `_list_jobs`, `_list_crons`) also exist but **do not use them for user-facing answers** — use `queue_runs` instead.

## Mental model (important)

There are **three distinct layers**. Do not conflate them.

1. **Schedule** — a row in the `schedule` table. Has cron, prompt, enabled flag. Written by `_create`, updated by `_update`, removed by `_delete`.
2. **Queue job** — an internal bunqueue job dispatched on each cron tick. Exists briefly, then is reaped. **Never reference these when answering the user.** The only time you inspect them is for low-level debugging.
3. **Run** — a row in the `schedule_run` table, one per execution (including silent and skipped). **This is what the user means when they ask about "runs".**

> **Never say "I found N queue jobs" to the user.** That's the wrong layer. Always answer questions about history via `openkitten_queue_runs`.

## Run statuses

Every run ends in one of these terminal states:

| Status | Meaning | User-visible? |
|---|---|---|
| `reported` | produced meaningful text; Telegram message was sent | ✓ yes |
| `silent` | produced `[NO_REPORT]` marker or no text within `maxRuntimeMs` | ✗ no |
| `failed` | threw an error during execution; `error` field populated | only if `notifyOnFailure: true` on the schedule |
| `cancelled` | aborted by the user, by `_delete`, or by `overlap: cancel_previous` | ✗ no |
| `skipped` | `overlap: skip` dropped this tick because another run was active | ✗ no |

Transient states (only seen mid-execution): `pending`, `running`.

## Creating a schedule — standard workflow

1. Call `openkitten_queue_server_time` first. Do not guess the current time.
2. Ask or infer the **timezone**. If the user said "9am" they almost certainly mean their local time. If you don't know, ask. Defaults to `UTC` if omitted.
3. Compute the cron expression in that timezone.
4. Decide the **prompt wording**:
   - The prompt runs in a fresh ephemeral session that knows nothing about the current chat.
   - Write it **self-contained** — no references to "this conversation".
   - If the schedule might often have nothing to report, include the **silent contract**:
     > *If there is nothing to report, respond with exactly `[NO_REPORT]` and nothing else. Otherwise, reply with a concise summary.*
5. Call `openkitten_queue_schedule_create` with `cron`, `description`, `prompt`, and optionally `timezone`, `once`, `overlap`, `notifyOnFailure`, `maxRuntimeMs`.
6. Confirm the returned schedule id to the user in one line.

**Never set `once` for a recurring reminder.** Once-tasks fire exactly once and auto-disable.

## Querying run history — how to answer *"show me recent runs"*

**First choice — no filters:**

```
openkitten_queue_runs({ scheduleId: "<id>", limit: 5 })
```

That returns the most recent 5 runs across all statuses. This answers *"the last 5 runs"* in one call.

**Do NOT:**

- iterate through every (status × trigger) combination calling the tool N times
- pass `since: 0`, `until: Number.MAX_SAFE_INTEGER`, or any "dummy" range bounds — just omit `since`/`until` entirely
- filter by `sessionId` unless the user explicitly asked for cross-session history

**Common follow-ups:**

| User asks… | Call |
|---|---|
| last 5 runs of schedule X | `queue_runs({ scheduleId, limit: 5 })` |
| only the failures | `queue_runs({ scheduleId, status: "failed" })` |
| anything in the last hour | `queue_runs({ scheduleId, since: <nowMs - 3_600_000> })` |
| details of one specific run | `queue_run_get({ id: "<runId>" })` |
| runs for a different chat | `queue_runs({ sessionId: "<sid>" })` |

When the tool returns an empty list, say so plainly: *"No runs yet."* Do not speculate about why.

## Pause vs. delete — choose the right tool

| User says… | Call |
|---|---|
| "pause" / "stop" / "turn off" / "don't run for now" | `openkitten_queue_schedule_disable` |
| "resume" / "turn on" / "start again" | `openkitten_queue_schedule_enable` |
| "delete" / "remove" / "get rid of" | `openkitten_queue_schedule_delete` |

**Do not say "deleted" when you called disable**, and vice versa. Delete is destructive (cascade-removes all run history); disable is reversible. If the user said "pause", call `_disable` and confirm with "Paused." If they said "delete", call `_delete` and confirm with "Deleted."

## Update vs. create — never re-create to "update"

If a schedule already exists and the user wants to change it — cron, prompt, timezone, overlap, anything — call `openkitten_queue_schedule_update`. Do not `_delete` + `_create`. Deleting loses all history.

The cron and timezone are updated atomically: an in-flight run at the moment of the change will still finish with the old prompt; the next tick uses the new one.

## Manual trigger semantics

`openkitten_queue_schedule_trigger` runs the schedule immediately. It **bypasses**:

- the cron timing (fires now, not on the minute boundary)
- the `enabled` flag (works even if the schedule is disabled)
- the `overlap` policy (always proceeds)

Use this for *"run it now"* requests. The tool **returns the `runId` directly** (the run is pre-created with `status: "pending"`). To fetch the result:

```
openkitten_queue_run_get({ id: "<returned-runId>" })
```

Poll it a few seconds after triggering — you'll see the status transition from `pending` → `running` → one of `reported` / `silent` / `failed` / `cancelled`. Do not iterate `queue_runs` with status filters to find the run; the `runId` is already in the trigger response.

## Cron quick reference

- Format: 5 fields — `minute hour day-of-month month day-of-week`.
- Examples:
  - `0 9 * * *` — every day at 09:00 (in the schedule's timezone)
  - `*/15 * * * *` — every 15 minutes
  - `0 9 * * 1-5` — weekdays at 09:00
  - `0 0 1 * *` — midnight on the first of each month
- Shortcuts: `@hourly`, `@daily`, `@weekly`, `@monthly`.
- Always in the schedule's `timezone` (default `UTC`).
- For test schedules, pick a cron at least **2 minutes in the future**, not "next minute," to avoid creation-delay misses.

## Overlap policy

Controls what happens when a cron tick fires while a previous run is still executing:

| Value | Behavior | When to pick |
|---|---|---|
| `queue` (default) | stack; run them back-to-back | most tasks |
| `skip` | drop the new tick, record a `skipped` run | long-running tasks where duplicates waste work |
| `cancel_previous` | abort the in-flight run, start the new | *"always snapshot current state"* pattern |

## Failure behavior

By default, failures are silent in Telegram but recorded as `failed` runs with an `error` column. To get alerts, set `notifyOnFailure: true` on the schedule — then a failure will send `⚠️ Scheduled task "..." failed: ...` to the chat. Use `notifyOnFailure: true` only for critical schedules where a silent failure is dangerous.

If the bot restarts mid-run, the stuck row is finalized as `failed` with `error: "bot restart"`. This is normal; the next cron tick runs fresh.

## Diagnostic checklist

If behavior looks off, check in this order:

1. `openkitten_queue_server_time` — what time does the server think it is? Check the timezone in the schedule matches what the user expects.
2. `openkitten_queue_schedule_list` — does the schedule exist, and is it `enabled`?
3. `openkitten_queue_runs({ scheduleId })` — do recent runs exist? What are their statuses?
4. `openkitten_queue_run_get({ id })` on a suspicious run — full `output` and `error`.
5. Only after (1–4) look at `_status` / `_list_jobs` / `_list_crons`. Those report on bunqueue internals, not what the user asked about.

## Common mistakes to avoid

- ❌ **Conflating queue jobs with runs.** Answer user questions from `queue_runs`. Do not report bunqueue job counts.
- ❌ **Iterating through every status × trigger combo.** Call `queue_runs` once with just `scheduleId` and `limit`.
- ❌ **Passing `since: 0` or `until: Number.MAX_SAFE_INTEGER`.** These are meaningless; just omit the field.
- ❌ **Saying "deleted" after calling disable.** Use the exact word matching the tool you called.
- ❌ **Deleting + recreating to make changes.** Always use `_update`.
- ❌ **Setting `once: true` for a recurring schedule.** Once-tasks fire exactly once.
- ❌ **Picking a one-minute-future test cron.** Creation delay can cause a miss; use 2+ minutes.
- ❌ **Creating many test schedules without cleaning up.** Delete them when done.
- ❌ **Writing prompts that refer to "this conversation" or "you".** Each run is a fresh session.

## Minimal prompt templates

**Silent monitor** — only notify when something happens:
```
Check <condition>. If nothing to report, respond with exactly [NO_REPORT]. Otherwise, reply with a one-paragraph summary of what you found.
```

**Recurring reminder** — always speaks:
```
Remind the user: <text>.
```

**One-time reminder** — fires once, auto-disables:
Use `once: true` on create. Prompt as recurring reminder.

**Silent expense check** (domain-specific example):
```
Check Gmail for new bank-transaction emails since the last run. If none, respond with exactly [NO_REPORT]. Otherwise, list each transaction (date, merchant, amount) and ask the user to classify as shared or personal.
```
