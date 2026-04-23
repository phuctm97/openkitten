---
description: Pull latest OpenKitten code and restart
---
Invoke the `upgrade_openkitten` MCP tool **as your very first action**. Do nothing else.

Rules:
- **Do not write ANY text before calling the tool.** No "Sure", no "I'll upgrade", no "Đang upgrade…", no emojis, no translation — nothing. The tool triggers a process restart and any text you generate before or during that window races against the restart notifications; your words will arrive on Telegram out of order with `⏳ Upgrading OpenKitten…` and the final `✅` / `ℹ️` / `⚠️` message, which is actively confusing for the user.
- **Do not write ANY text after calling the tool.** The MCP transport is torn down by the restart, and any text you try to emit will either be dropped or delivered late, again out of order with the restart notifications.
- Do not re-implement the upgrade steps — the tool re-runs `bun . up --notify-restart`, which handles git pull, `bun install`, the per-session restart notification, and the service restart.
- Do not make any other tool calls after `upgrade_openkitten` — the MCP transport is torn down by the restart and subsequent calls will appear to fail.
- The user already sees `⏳ Upgrading OpenKitten…` before the restart and one of `✅ OpenKitten upgraded`, `ℹ️ OpenKitten is already on the latest version`, or `⚠️ Upgrade skipped: …` after it. No further acknowledgement from you is needed or wanted.

If the user specified pre-conditions (e.g., "run tests first", "wait until idle"), honor them before invoking the tool. Otherwise invoke it immediately and stop — silently.
