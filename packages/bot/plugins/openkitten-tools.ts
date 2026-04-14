/**
 * Example plugin for OpenKitten using @openkitten/plugin.
 *
 * This file demonstrates how to write a plugin that accesses
 * the bot's internal API (sessions, bot info, etc.) and the
 * Telegram Bot API.
 *
 * To install:
 *
 *   cp packages/bot/plugins/openkitten-tools.ts \
 *      ~/.openkitten/profiles/default/.opencode/plugins/
 *
 * Then restart the bot. The tools will appear in the agent's tool list.
 *
 * Dependencies (@openkitten/plugin, grammy) are installed automatically
 * by the bot on startup — no manual package.json setup needed.
 */

import { definePlugin, tool } from "@openkitten/plugin";

export default definePlugin("openkitten-tools", async ({ openkitten }) => ({
  tool: {
    openkitten_bot_info: tool({
      description:
        "Get the Telegram bot identity — id, username, display name.",
      args: {},
      async execute() {
        const info = await openkitten.api.getBotInfo();
        return JSON.stringify(info);
      },
    }),
    openkitten_list_sessions: tool({
      description:
        "List all active OpenKitten sessions with their Telegram chat mappings.",
      args: {},
      async execute() {
        const sessions = await openkitten.api.listSessions();
        return JSON.stringify(sessions);
      },
    }),
  },
}));
