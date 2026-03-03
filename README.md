# OpenKitten

Telegram-first AI agent with 75+ AI providers, OS-level sandbox, and built-in capabilities people actually need.

## Motivation

**OpenClaw** is the dominant open-source AI agent, but it has become buggy and almost unusable. With ~500k lines of code, it's overwhelming — hard to tell what's causing issues, what might break next, and what security risks are lurking underneath.

**NanoClaw** took the right approach by going minimal at ~500 lines of code, but it's Claude-only and more of a starting point than a product. You'll need to add a lot yourself before it becomes actually useful.

**How is OpenKitten different?**

- **Telegram-first** — the best chatbot experience on the best messaging platform
- **Fast and safe by default** — powered by Bun and OS-level sandbox runtime
- **75+ AI providers** — multiple models, multiple providers out of the box through OpenCode
- **Batteries included** — Gmail, calendar, and more — ready to work for you from day one
- **Highly extensible** — rich plugin and skill ecosystem to customize for any use case

## Setup

### Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/phuctm97/openkitten/main/install.sh | bash
```

Set `OPENKITTEN_DIR` to customize the install directory (defaults to `~/.openkitten`).

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram user ID (send `/start` to [@userinfobot](https://t.me/userinfobot))
- At least one AI provider API key

### Manual Install

```bash
git clone https://github.com/phuctm97/openkitten.git
cd openkitten
bun install
bun setup
bun start
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
# export DANGEROUSLY_DISABLE_SANDBOX=1  # Bypass OS-level sandbox
```

## Usage

Send any message to chat with the AI — a session is created automatically on your first message. When the AI needs to run a command or edit a file, you'll see inline buttons to approve or deny. The AI can also ask interactive questions with option buttons or free-text input.

### Chat Commands

- `/start` — Start a new session
- `/stop` — Abort the current request
- `/help` — Show help

### CLI Commands

- `bun start` — Start the bot
- `bun setup` — Check dependencies, configure environment variables, and install the system service
- `bun self-update` — Update to the latest version (pulls changes, installs dependencies, restarts service)

### Supported Media

You can send and receive photos, videos, documents, voice messages, audio files, video notes, and stickers. Captions are forwarded alongside media. The AI can send back photos, videos, documents, audio, voice messages, and GIF animations.

File size limit: 20 MB (Telegram Bot API limit).

## Architecture

```
Telegram <--> grammY Bot <--> Sandbox <--> OpenCode Server <--> AI Provider APIs
                  |                             |
          SQLite + In-memory State      Built-in Tools (bash, edit, read, webfetch, etc.)
```

### Sandbox

The OpenCode server runs inside an OS-level sandbox (via `@anthropic-ai/sandbox-runtime`) that restricts filesystem and network access:

- **Read-blocked:** Credential directories — `~/.ssh`, `~/.aws`, `~/.azure`, `~/.config/gcloud`, `~/.docker`, `~/.kube`, `~/.gnupg`, `~/.npmrc`, `~/.yarnrc`, `~/.netrc`, `~/.config/gh`, `~/.config/op`
- **Write-protected:** `.env*` (all variants), `*.pem`, `*.key`
- **Network:** Comprehensive allowlist covering 17+ AI providers, package registries, version control, container registries, cloud platforms, and dev tools. All other domains are blocked.

The sandbox runtime also automatically blocks writes to shell configs (`.bashrc`, `.zshrc`, `.profile`), git config, and IDE directories.

Set `DANGEROUSLY_DISABLE_SANDBOX=1` to bypass.

### System Service

`bun setup` automatically installs OpenKitten as a system service that starts on boot and auto-restarts on failure:

- **macOS** — LaunchAgent (`~/Library/LaunchAgents/com.openkitten.bot.plist`)
- **Linux** — systemd user unit (`~/.config/systemd/user/openkitten.service`)

Logs are written to `~/.local/log/openkitten/`.
