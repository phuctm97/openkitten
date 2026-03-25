# OpenKitten 😼

![TypeScript](https://img.shields.io/badge/TypeScript-language-3178c6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-runtime-fbf0df?logo=bun&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-100%25%20coverage-729b1b?logo=vitest&logoColor=white)
![Biome](https://img.shields.io/badge/Biome-linted%20%26%20formatted-60a5fa?logo=biome&logoColor=white)

**Telegram-first** 💬 AI agent with **75+ AI providers** 🤖, **extensible plugins** 🧩, **multiple (sub)agents** 🤝, **composable skills** 🧱, and **controlled permissions** 🔒.

## Motivation

OpenClaw is the dominant open-source AI agent, but it has become buggy and almost unusable. With ~500k lines of code, it's overwhelming — hard to tell what's causing issues, what might break next, and what security risks are lurking underneath.

NanoClaw took the right approach by going minimal at ~500 lines of code, but it's Claude-only and more of a starting point than a product. You'll need to add a lot yourself before it becomes actually useful.

### How is OpenKitten different?

- **Built for Telegram** — the best chatbot experience on the best messaging platform
- **Powered by OpenCode** — 75+ AI providers with rich plugin & skill ecosystem
- **Opinionated on purpose** — fewer choices, more capability, zero bloat

> [!NOTE]
> OpenKitten is in early development. Things may break between releases.

## Setup

### Prepare

- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram user ID (send `/start` to [@userinfobot](https://t.me/userinfobot))

### Install

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Clone OpenKitten
git clone https://github.com/phuctm97/openkitten.git
cd openkitten

# Install dependencies
bun install

# Start OpenKitten
bun . serve
```

## Configuration

### Log level

Set via `OPENKITTEN_LOG_LEVEL` (defaults to `silly`):

```bash
OPENKITTEN_LOG_LEVEL=info bun . serve
```

Levels: `silly`, `trace`, `debug`, `info`, `warn`, `error`, `fatal`.

### Profile

Set via `OPENKITTEN_PROFILE` (defaults to `default`):

```bash
OPENKITTEN_PROFILE=work bun . serve
```

Each profile isolates its config & data at `~/.openkitten/profiles/<profile>`.

### Telegram

OpenKitten prompts for your Telegram bot token and user ID if not already configured, then saves them to `~/.openkitten/profiles/<profile>/system/config/openkitten/telegram-auth.json`. To re-authenticate, delete the file and restart the bot.

### OpenCode

OpenKitten bootstraps an OpenCode config directory per profile at `~/.openkitten/profiles/<profile>/.opencode`. On first run, it generates:

```
.opencode/
├── opencode.json       # OpenCode configuration
└── agents/
    ├── assist.md       # General purpose agent (default)
    ├── build.md        # Software engineering agent
    └── plan.md         # Read-only research & planning agent
```

Edit `opencode.json` to configure providers, models, agents, commands, permissions, MCP servers, and more. See [OpenCode config docs](https://opencode.ai/docs/config) for all available options.
