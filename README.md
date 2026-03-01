# OpenKitten

Opinionated, batteries-included AI agent on Telegram.

Most AI agent projects give you a framework and leave you to wire everything up. OpenKitten ships the features most people actually need — built-in integrations, sensible defaults, and a single `bun run start` to get going. It supports 75+ AI providers through [OpenCode](https://github.com/nicholasoxford/opencode), runs inside an OS-native sandbox, and handles text, photos, videos, documents, voice messages, and more — in both directions.

## Why OpenKitten?

**OpenClaw** is the dominant open-source AI agent, but it has become buggy and almost unusable. With ~400k+ lines of code, it's overwhelming — hard to tell what's causing issues, what might break next, and what security risks are lurking underneath.

**NanoClaw** took the right approach by going minimal (~3,900 lines, Claude-only), but it's a starting point, not a product. You'll need to add a lot yourself before it becomes actually useful.

**OpenKitten** is different. It's Telegram-first — we're building the best chatbot experience on the best messaging platform. Powered by Bun and OS-native sandbox for fast and safe usage by default. Multiple models, multiple providers out of the box through OpenCode, with a plugin and skill ecosystem to customize for any use case. And it ships the integrations people actually need — Gmail, calendar, email — so you don't have to build them yourself.

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

# Optional:
# export DANGEROUSLY_DISABLE_SANDBOX=1  # Bypass OS-native sandbox
```

## Usage

Send any message to chat with the AI — a session is created automatically on your first message. When the AI needs to run a command or edit a file, you'll see inline buttons to approve or deny. The AI can also ask interactive questions with option buttons or free-text input.

### Commands

- `/start` — Start a new session
- `/stop` — Abort the current request
- `/help` — Show help

### Supported Media

You can send and receive photos, videos, documents, voice messages, audio files, video notes, and stickers. Captions are forwarded alongside media. The AI can send back photos, videos, documents, audio, voice messages, and GIF animations.

File size limit: 20 MB (Telegram Bot API limit).

## Architecture

```
Telegram <--> grammY Bot <--> Sandbox <--> OpenCode Server <--> AI Provider APIs
                  |                             |
            In-memory State            Built-in Tools (bash, edit, read, webfetch, etc.)
```

### Sandbox

The OpenCode server runs inside an OS-native sandbox (via `@anthropic-ai/sandbox-runtime`) that restricts filesystem and network access:

- **Read-blocked:** `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config/gcloud`
- **Write-protected:** `.env`, `.env.local`, `.env.production`
- **Network:** Limited to known AI provider domains

Set `DANGEROUSLY_DISABLE_SANDBOX=1` to bypass.

### Source Files

| File | Role |
|------|------|
| `packages/bot/lib/index.ts` | Entry point: env validation, bot setup, media handlers, shutdown |
| `packages/bot/lib/commands.ts` | `/start`, `/stop`, `/help` command handlers |
| `packages/bot/lib/handlers.ts` | Callback query handlers for permissions and interactive questions |
| `packages/bot/lib/events.ts` | SSE event processing: typing indicators, text/file accumulation, questions |
| `packages/bot/lib/files.ts` | File download/upload, MIME routing, filename sanitization |
| `packages/bot/lib/markdown.ts` | MarkdownV2 conversion with content-aware message splitting |
| `packages/bot/lib/opencode.ts` | OpenCode SDK client wrapper with SSE reconnection |
| `packages/bot/lib/sandbox.ts` | OS-native sandbox for the OpenCode server |
| `packages/bot/lib/state.ts` | In-memory state (sessions, accumulated text/files, permissions, questions) |

## Roadmap

### Built-in Integrations

- Gmail (read, send, search)
- IMAP (generic email)
- Calendar

### Platform

- Multi-user support with allowlist and per-user state isolation
- Per-user sandboxed OpenCode server instances
- `/model`, `/provider`, `/config` commands
- Webhook mode for production

## License

MIT
