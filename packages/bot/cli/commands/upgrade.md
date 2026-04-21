---
description: Pull latest OpenKitten code and restart
---
Invoke the `upgrade_openkitten` MCP tool. Do nothing else.

Rules:
- Do NOT re-implement the upgrade steps — the tool handles git fetch, pull, `bun install`, session notifications, and the process restart.
- Do NOT narrate, explain, offer help, or add follow-up messages. The tool's restart will interrupt your response mid-sentence and any apology or error-speculation you generate during that window will reach the user as a misleading message.
- Do NOT make any other tool calls after `upgrade_openkitten` — the MCP transport is torn down by the restart and subsequent calls will appear to fail.
- The user already sees `⏳ Upgrading OpenKitten…` before the restart and `✅ Upgraded <previous-sha> → <new-sha>` after it. No further acknowledgement from you is needed.

If the user specified pre-conditions (e.g., "run tests first", "wait until idle"), honor them before invoking the tool. Otherwise invoke it immediately and stop.
