---
name: create-commands
description: Create, delete, and list custom Telegram bot commands by writing command skill files and refreshing the Telegram command menu.
---

# Custom Commands

Custom Telegram bot commands are stored as skill directories under `$XDG_CONFIG_HOME/opencode/skills`. Each command becomes available as `/name` in Telegram.

A command directory contains two files:

- `command.json` — machine-readable definition (name, description, prompt)
- `SKILL.md` — OpenCode skill that the agent loads when the command is invoked

For the list of OpenCode built-in commands, read `opencode-commands.md` in this skill directory.

## Command Names

- Pattern: `^[a-z][a-z0-9_]{0,30}$`
- Reserved (builtin): `start`, `abort`, `compact`, `agent`

## File Formats

### command.json

```json
{
  "name": "translate",
  "description": "Translate text to English",
  "prompt": "Translate the following text to English."
}
```

Description is shown in the Telegram command menu (max 256 chars). Prompt is the instruction the agent follows when the command is used.

### SKILL.md

```
---
name: command-translate
description: Handle the /translate Telegram command — Translate text to English
---

# /translate Command

When the user sends a message starting with `/translate`, execute the following instruction.

## Instruction

Translate the following text to English.
```

The `name` field is `command-{name}`. The description follows the pattern `Handle the /{name} Telegram command — {description}`.

## Refreshing the Telegram Menu

After creating or deleting a command, run the refresh script to update the Telegram command menu:

```bash
bun "$XDG_CONFIG_HOME/opencode/skills/create-commands/refresh-commands.ts"
```

## Listing Commands

```bash
for f in "$XDG_CONFIG_HOME"/opencode/skills/*/command.json; do [ -f "$f" ] && cat "$f"; done
```
