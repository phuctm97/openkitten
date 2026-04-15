/**
 * Example plugin for OpenKitten using @openkitten/plugin.
 *
 * This file demonstrates how to write a plugin that accesses
 * the bot's API to retrieve the bot token, then uses it to
 * call the Telegram Bot API directly.
 *
 * To install:
 *
 *   cp packages/bot/plugins/openkitten-tools.ts \
 *      ~/.openkitten/profiles/default/.opencode/plugins/
 *
 * Then restart the bot. The tools will appear in the agent's tool list.
 *
 * Dependencies (@openkitten/plugin) are installed automatically
 * by the bot on startup — no manual package.json setup needed.
 */

import { definePlugin, tool } from "@openkitten/plugin";

export default definePlugin("openkitten-tools", async ({ openkitten }) => ({
  tool: {
    openkitten_bot_token: tool({
      description: "Get the Telegram bot token for direct API access.",
      args: {},
      async execute() {
        const token = await openkitten.api.getBotToken();
        return token;
      },
    }),
  },
}));
