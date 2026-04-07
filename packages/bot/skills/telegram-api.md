# Telegram Bot API

Use this guide when managing the Telegram bot itself — changing bot name, description, avatar, deleting messages, setting commands, or any bot administration task not related to sending messages.

## Bot Token

Read the bot token from `$XDG_CONFIG_HOME/openkitten/telegram.json`:

```json
{
  "botToken": "<bot_id>:<bot_secret>",
  "userId": 12345
}
```

Extract the `botToken` value. **Never log, echo, or expose the bot token in output.**

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
