# OpenKitten

AI agent on Telegram. Supports 75+ AI providers through [OpenCode](https://github.com/nicholasoxford/opencode), with tool use (shell commands, file editing, web browsing) and interactive permission controls.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram user ID (send `/start` to [@userinfobot](https://t.me/userinfobot))
- At least one AI provider API key

### Setup

```bash
git clone https://github.com/your-org/openkitten.git
cd openkitten
bun install
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

### Run

```bash
bun run start --filter @openkitten/bot
```

Or from the bot package directly:

```bash
cd packages/bot
bun run start
```

## Usage

| Command | Description |
|---------|-------------|
| `/start` | Connect to a project |
| `/new` | Create a new session |
| `/stop` | Abort the current request |
| `/help` | Show help message |

Send any text message to chat with the AI. When the AI needs to run a command or edit a file, you'll see inline buttons to approve or deny the action.

## Docker

```bash
docker compose up
```

Set environment variables in a `.env` file or pass them directly:

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_USER_ID=... ANTHROPIC_API_KEY=... docker compose up
```

## Architecture

```
Telegram → grammY Bot → OpenCode Server → AI Provider APIs
                ↕                ↕
          In-memory State    Built-in Tools (bash, edit, read, webfetch, etc.)
```

- **Runtime**: Bun
- **Telegram**: grammY with auto-retry
- **AI Engine**: OpenCode SDK (75+ providers)
- **State**: In-memory (single-user MVP)

See [SPEC.md](./SPEC.md) for full technical documentation.

## Project Structure

```
openkitten/
  packages/
    bot/
      lib/
        index.ts        Entry point
        commands.ts     Bot commands (/start, /new, /stop, /help)
        handlers.ts     Callback query handlers (permissions, questions)
        events.ts       SSE event processing
        opencode.ts     OpenCode SDK client wrapper
        state.ts        In-memory state management
```

## License

MIT
