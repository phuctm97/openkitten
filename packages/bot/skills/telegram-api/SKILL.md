---
name: telegram-api
description: Manage the Telegram bot — read bot token, call Telegram Bot API methods, change bot settings, delete messages, and other bot administration tasks.
---

# Telegram Bot API

Use this skill when managing the Telegram bot itself — changing bot name, description, avatar, deleting messages, setting commands, or any bot administration task not related to sending messages.

## Bot Token

Run the helper script to read the bot token securely:

```bash
bash ./get-token.sh
```

Or in TypeScript:

```bash
bun ./get-token.ts
```

**Never log, echo, or expose the bot token in any other output.**

## API Documentation

Fetch the full method list, parameters, and types from the official documentation:

- **URL**: `https://core.telegram.org/bots/api`

Alternatively, use the context7 MCP to query up-to-date docs:

1. Call `resolve-library-id` with `"Telegram Bot API"` to get the library ID.
2. Call `query-docs` with the resolved ID and your specific question.

## Making API Calls

```
https://api.telegram.org/bot<token>/METHOD_NAME
```

- Methods accept GET or POST with `application/json` or `multipart/form-data`.
- Responses are JSON: check `ok` is `true` before reading `result`.
