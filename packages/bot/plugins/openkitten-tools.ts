/**
 * Example plugin for OpenKitten using @openkitten/plugin.
 *
 * This file demonstrates how to write a plugin that accesses
 * the bot's API, OpenCode client, and plugin options.
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

export default definePlugin(
  "openkitten-tools",
  async ({ openkitten, opencode, options }) => ({
    tool: {
      openkitten_bot_token: tool({
        description: "Get the Telegram bot token for direct API access.",
        args: {},
        async execute() {
          const token = await openkitten.api.getBotToken();
          return token;
        },
      }),
      openkitten_project_info: tool({
        description:
          "Get the current OpenCode project info and working directory.",
        args: {},
        async execute() {
          return JSON.stringify({
            directory: opencode.directory,
            worktree: opencode.worktree,
            serverUrl: opencode.serverUrl.href,
            hasOptions: options !== undefined,
          });
        },
      }),
    },
  }),
);
