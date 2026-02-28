# OpenKitten

AI agent on Telegram. Supports 75+ AI providers through [OpenCode](https://github.com/nicholasoxford/opencode), with tool use (shell commands, file editing, web browsing) and interactive permission controls.

## Setup

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram user ID (send `/start` to [@userinfobot](https://t.me/userinfobot))
- At least one AI provider API key

### Install & Run

```bash
git clone https://github.com/phuctm97/openkitten.git
cd openkitten
bun install
bun run start --filter @openkitten/bot
```

### Environment Variables

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_USER_ID="your-numeric-user-id"

# At least one AI provider key:
export ANTHROPIC_API_KEY="sk-ant-..."
# or OPENAI_API_KEY="sk-..."
# or any of 75+ providers supported by OpenCode
```

### Docker

```bash
docker compose up
```

Set environment variables in a `.env` file or pass them directly:

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_USER_ID=... ANTHROPIC_API_KEY=... docker compose up
```

## Usage

Send any text message to chat with the AI. When the AI needs to run a command or edit a file, you'll see inline buttons to approve or deny.

- `/start` — Start a new session
- `/stop` — Abort the current request
- `/help` — Show help

## Architecture

```
Telegram --> grammY Bot --> OpenCode Server --> AI Provider APIs
                 |                 |
           In-memory State    Built-in Tools (bash, edit, read, webfetch, etc.)
```

### Source Files

| File | Role |
|------|------|
| `packages/bot/lib/index.ts` | Entry point: env validation, bot setup, message routing, shutdown |
| `packages/bot/lib/commands.ts` | `/start`, `/stop`, `/help` command handlers |
| `packages/bot/lib/handlers.ts` | Callback query handlers for permissions and interactive questions |
| `packages/bot/lib/events.ts` | SSE event processing, typing indicators, message chunking |
| `packages/bot/lib/opencode.ts` | OpenCode SDK client wrapper with SSE reconnection |
| `packages/bot/lib/state.ts` | In-memory state (sessions, accumulated text, pending permissions) |

## Roadmap

### Phase 2: Container Isolation + Persistence

- Docker container lifecycle management
- One OpenCode server per user in isolated container
- SQLite for user-container mapping and session persistence
- File upload/download through Telegram
- Persisted "always allow" permission rules

### Phase 3: Multi-User + Polish

- Multi-user support with allowlist
- Per-user state isolation
- Streaming responses via `@grammyjs/stream`
- Telegram MarkdownV2 formatting for code blocks
- `/model`, `/provider`, `/config` commands
- Webhook mode for production
- Scheduled tasks

## License

MIT
