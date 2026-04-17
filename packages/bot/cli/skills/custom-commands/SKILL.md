---
name: custom-commands
description: Create, delete, and list custom Telegram bot commands as markdown files in the commands directory, then reload via the reload_commands tool.
---

# Custom Commands

Custom commands are markdown files in the commands directory. Each `.md` file becomes a `/command` — the filename (without `.md`) is the command name.

The commands directory path is: `$OPENCODE_CONFIG_DIR/commands/`

IMPORTANT: Write files DIRECTLY to `$OPENCODE_CONFIG_DIR/commands/`. Do NOT navigate, explore, or resolve the path manually — use it as-is.

## How to Create a Command

1. Write a `.md` file to `$OPENCODE_CONFIG_DIR/commands/{name}.md`
2. Call the `reload_commands` tool to apply changes immediately

### File Format

```markdown
---
description: Translate text to English
---
Translate the following text to English: $ARGUMENTS
```

Frontmatter fields:
- `description` (required) — shown in the Telegram command menu (max 256 chars)
- `agent` (optional) — which agent executes the command
- `model` (optional) — override the default model

Body: the prompt template. Use these placeholders:
- `$ARGUMENTS` — all user input after the command name
- `$1`, `$2`, `$3` — positional arguments

### Example

To create `/weather`, write directly to `$OPENCODE_CONFIG_DIR/commands/weather.md`:

```markdown
---
description: Check the weather for a location
---
Check the current weather for: $ARGUMENTS

Provide temperature, conditions, and a brief forecast.
```

Then call `reload_commands`.

## How to Delete a Command

1. Delete `$OPENCODE_CONFIG_DIR/commands/{name}.md`
2. Call the `reload_commands` tool to apply changes immediately

## How to List Commands

List files in `$OPENCODE_CONFIG_DIR/commands/`.

## Command Name Rules

- Filename must match: `^[a-z][a-z0-9_]{0,30}\.md$`
- Must NOT conflict with any reserved name listed below

## Reserved Commands (DO NOT create these)

Telegram bot built-in commands:
- `/start` — Start a new conversation
- `/abort` — Stop the current generation
- `/compact` — Summarize conversation history
- `/agent` — Switch or list AI agents

OpenCode built-in commands (users can use these directly):
`/compact` `/connect` `/details` `/editor` `/exit` `/export` `/help` `/init` `/models` `/new` `/redo` `/sessions` `/share` `/themes` `/thinking` `/undo` `/unshare`

If a user asks about these built-in commands, tell them they can use them directly — no custom command needed.
