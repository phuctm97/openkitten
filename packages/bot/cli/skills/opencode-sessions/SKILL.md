---
name: opencode-sessions
description: Inspect OpenCode sessions from the shell — list them, export one, read its messages. Use whenever the user asks about an existing session, wants to pick a session to bind a schedule to, or wants to know what happened inside a session.
---

# OpenCode Sessions

## System context — read this first

You are running as the AI brain of **OpenKitten**, a Telegram bot. OpenKitten uses **OpenCode** underneath: every Telegram chat (or forum thread) is mapped to an OpenCode session, and when a user types a message on Telegram, OpenKitten forwards it as a prompt into the corresponding OpenCode session — which is how *you* end up handling it.

That means:

- **You are running inside an OpenCode session right now.** There are other OpenCode sessions on the same server (other chats, or sessions the user created outside Telegram). This skill lets you enumerate and read them.
- The OpenCode server OpenKitten manages is **not** the same as any standalone `opencode` the user might have installed globally. You must use the OpenKitten-vendored binary — its absolute path is in `$OPENKITTEN_OPENCODE_BIN`. Never invoke a bare `opencode` on `PATH`: that may resolve to a different installation with a different data store, and you'll see unrelated sessions (or nothing at all).
- OpenKitten stores its own Telegram-chat ↔ OpenCode-session mapping in a separate SQLite database (not part of OpenCode). Session ids returned here are opaque OpenCode ids; some of them are the current Telegram chat sessions, others are not.

Every command below uses `$OPENKITTEN_OPENCODE_BIN` explicitly — don't drop the prefix.

## What this skill covers

An **OpenCode session** is a persistent, multi-turn conversation with its own message history, title, working directory, and lifecycle. Sessions are the unit the scheduler can **bind to** — a session-bound schedule (see the `schedules` skill) sends its prompt into the same session every tick, so context carries across runs.

Sessions are distinct from Telegram chats:

- A **chat-bound schedule** creates a *fresh* ephemeral session on every cron tick. No memory across runs.
- A **session-bound schedule** targets a specific, long-lived session. Each tick adds a new user message to that session; the assistant's reply is persisted in the session's history.

When the user asks to "monitor X in the same thread we've been discussing" or "run it in the session where we set up Y", that's a session-bound schedule — and you need a session id to create it. This skill is how you find that id.

## Listing sessions

Default call — the 10 most recent sessions as JSON:

```
"$OPENKITTEN_OPENCODE_BIN" session list --format json -n 10
```

Pipe through `jq` to get the ids + titles you actually need:

```
"$OPENKITTEN_OPENCODE_BIN" session list --format json -n 10 | jq -r '.[] | "\(.id)\t\(.title)\t\(.time.updated)"'
```

Each element has (at minimum) `id`, `title`, `directory`, `projectID`, `time.created`, `time.updated`. The `title` is usually enough for the user to recognize a session.

**Search for a session by title substring** — post-filter with `jq`:

```
"$OPENKITTEN_OPENCODE_BIN" session list --format json -n 50 | jq -r '.[] | select(.title | test("expense"; "i")) | .id'
```

When the list is empty, say so plainly: *"No OpenCode sessions yet."* Don't speculate.

## Exporting one session's full data

For one session you already have the id of — full metadata plus its entire message history as JSON:

```
"$OPENKITTEN_OPENCODE_BIN" export <sessionID>
```

The output is a JSON document. Use `jq` to pull only what you need — don't dump the whole thing into your reply.

**Session metadata only** (skip messages):

```
"$OPENKITTEN_OPENCODE_BIN" export <sessionID> | jq '{ id: .id, title: .title, directory: .directory, created: .time.created, updated: .time.updated }'
```

**Last 20 messages as role + text**:

```
"$OPENKITTEN_OPENCODE_BIN" export <sessionID> | jq '.messages[-20:] | .[] | { role: .info.role, text: ([.parts[]? | select(.type == "text") | .text] | join("")) }'
```

**Count of messages**:

```
"$OPENKITTEN_OPENCODE_BIN" export <sessionID> | jq '.messages | length'
```

Avoid piping the full export into your context — even medium-size sessions are thousands of lines. Always narrow with `jq` first.

## Privacy-sensitive export

If the user wants to share or inspect a session but strip transcripts and file data, use `--sanitize`:

```
"$OPENKITTEN_OPENCODE_BIN" export <sessionID> --sanitize
```

That's rarely needed when you're just picking an id for a schedule — but it exists when output might be leaking to a log or third party.

## Inspecting the session a scheduled run executed in

Each `schedule_run` record (from `openkitten_queue_runs` or `openkitten_queue_run_get`) has a `runSessionId` — the OpenCode session the prompt actually ran in. Use the same `export` / `jq` recipes above on that id to retrace what the run did (tool calls, reasoning, intermediate assistant messages).

See the **"Inspecting what happened inside a run's session"** section in the `schedules` skill for the end-to-end workflow and the mode-specific gotchas (chat-bound runs get their own ephemeral session each tick; session-bound runs all share the pinned session, so you may need to filter by message creation time).

## Picking a session to bind a schedule to

Typical flow when the user says *"every hour, check X in my session"*:

1. Run `"$OPENKITTEN_OPENCODE_BIN" session list --format json -n 10` and pipe to `jq` to get id + title + updated-at.
2. Show 3–5 candidates to the user, or match by title if unambiguous.
3. Optionally `"$OPENKITTEN_OPENCODE_BIN" export <sessionID> | jq '{ title, directory, updated: .time.updated }'` to sanity-check.
4. Pass the chosen id as `sessionId` when calling `openkitten_queue_schedule_create`. See the `schedules` skill for the create call.

If the user already named a session id verbatim, skip the list step — run `"$OPENKITTEN_OPENCODE_BIN" export <id> | jq '.title'` to verify it exists before binding.

## Common mistakes to avoid

- ❌ **Invoking `opencode` without the `$OPENKITTEN_OPENCODE_BIN` prefix.** That may resolve to a different binary with a different data store. Always quote the variable.
- ❌ **Binding a schedule to a session without verifying it exists.** If the export command exits non-zero, the id is wrong or the session was deleted — handle that before calling `queue_schedule_create`.
- ❌ **Dumping the full export output.** Always narrow with `jq`. A single session's export can be megabytes.
- ❌ **Parsing the default `table` format of `session list`.** It's for humans. Always pass `--format json` when scripting.
- ❌ **Confusing a session's `id` with its `slug` or `title`.** Always use `id` when passing to other tools.
- ❌ **Treating chat-bound and session-bound as interchangeable.** If the user wants context continuity across runs, it must be session-bound. If they want a stateless periodic check, chat-bound is simpler.
- ⚠️ **Binding a schedule to a session that is still being actively chatted in.** The scheduler reads the latest assistant reply after each tick — concurrent user messages can cause the scheduler to capture text from the wrong exchange. Prefer sessions that are quiescent between ticks. If you're not sure, warn the user before binding.
