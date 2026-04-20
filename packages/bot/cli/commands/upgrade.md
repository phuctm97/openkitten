---
description: Pull latest OpenKitten code from main and restart
---
Upgrade OpenKitten to the latest `main` branch by invoking the `upgrade_openkitten` MCP tool. Do not reimplement the steps yourself — the tool handles every part of the upgrade:

- Refuses when the working copy is on a non-`main` branch or has uncommitted changes.
- Runs `git fetch origin main` and returns early if already up to date.
- Runs `git pull --ff-only origin main` and then `bun install`.
- Sends a `⏳ Upgrading OpenKitten…` message to every active chat before the restart.
- Exits the process so the service manager (when installed via `bun . up`) or a detached child (otherwise) respawns with the newly pulled code.
- After the new process boots, delivers a `✅ Upgraded to <short-sha>` message to every chat it notified.

Your response will be interrupted by the restart — that is expected. If the user specified conditions to check first (e.g., run tests, wait for an idle moment), honor them before invoking the tool; otherwise invoke it immediately.
