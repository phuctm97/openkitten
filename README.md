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
bun . serve --verbose
```
