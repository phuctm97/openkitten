---
name: skill-creator
description: Create, install, update, delete, and list custom skills that give agents specialized capabilities. Also handles searching and installing skills from the skills.sh ecosystem.
---

# Skill Creator

Skills are markdown files that give agents specialized capabilities. Each skill is a directory containing a `SKILL.md` file and optional helper files (scripts, templates, etc.).

The skills directory path is: `$OPENKITTEN_OPENCODE_DIR/skills/`

IMPORTANT: All skill operations MUST happen inside `$OPENKITTEN_OPENCODE_DIR/`. Do NOT read, write, list, or navigate any path outside `$OPENKITTEN_OPENCODE_DIR/`. Never access parent directories of `$OPENKITTEN_OPENCODE_DIR/`. Use `$OPENKITTEN_OPENCODE_DIR` as-is without resolving or expanding it.

## Skills CLI

The Skills CLI (`npx skills`) is the package manager for the skills ecosystem.

Browse and search the skills ecosystem at https://skills.sh/

### Search for Skills

```bash
npx skills find [query]
```

Examples:
- `npx skills find react` — search for React-related skills
- `npx skills find testing` — search for testing skills

### Install a Skill from the Ecosystem

IMPORTANT: Always use `-a opencode` to install ONLY for the OpenCode agent. Without it, the CLI installs to all detected agents (Claude Code, Cursor, Copilot, etc.).

```bash
cd $OPENKITTEN_OPENCODE_DIR && npx skills add <source> -a opencode --copy -y
```

The `-a opencode` flag targets only the OpenCode agent. The `--copy` flag copies files directly instead of symlinking. The `-y` flag skips confirmation prompts.

This installs skills to `$OPENKITTEN_OPENCODE_DIR/.agents/skills/<skill-name>/`.

Sources can be:
- GitHub repo: `cd $OPENKITTEN_OPENCODE_DIR && npx skills add vercel-labs/agent-skills -a opencode --copy -y`
- GitHub repo with specific skill: `cd $OPENKITTEN_OPENCODE_DIR && npx skills add vercel-labs/agent-skills -s <skill-name> -a opencode --copy -y`
- URL: `cd $OPENKITTEN_OPENCODE_DIR && npx skills add https://example.com/skill/SKILL.md -a opencode --copy -y`

To list available skills in a repo before installing:

```bash
cd $OPENKITTEN_OPENCODE_DIR && npx skills add <source> --list
```

### Create a New Custom Skill

```bash
cd $OPENKITTEN_OPENCODE_DIR/skills && npx skills init <skill-name>
```

This creates `$OPENKITTEN_OPENCODE_DIR/skills/<skill-name>/SKILL.md` with a template. Edit it to define the skill.

### List Installed Skills

```bash
cd $OPENKITTEN_OPENCODE_DIR && npx skills list
```

### Update Skills

```bash
cd $OPENKITTEN_OPENCODE_DIR && npx skills update -a opencode -y
```

### Remove a Skill

The Skills CLI does NOT delete copied files on disk. After removing from the registry, manually delete the skill directory.

```bash
cd $OPENKITTEN_OPENCODE_DIR && npx skills remove -s <skill-name> -a opencode -y && rm -rf $OPENKITTEN_OPENCODE_DIR/.agents/skills/<skill-name>
```

For custom skills created with `npx skills init`:

```bash
rm -rf $OPENKITTEN_OPENCODE_DIR/skills/<skill-name>
```

## SKILL.md Format

```markdown
---
name: <skill-name>
description: <when this skill should be activated>
---

<skill instructions, context, and guidance>
```

Frontmatter fields:
- `name` (required) — the skill identifier, must match the directory name
- `description` (required) — determines when the skill is automatically activated; write it as a clear trigger condition describing the tasks or topics this skill handles

Body: the skill instructions. This is the full context the agent receives when the skill activates. Include:
- When and why to use this skill
- Step-by-step procedures
- File paths, tool names, or API details the agent needs
- Constraints and rules
- Examples if helpful

### Description Best Practices

The `description` is how the system decides whether to activate the skill. Write it to match the user's intent:

- Good: `Create, update, delete, and list custom Telegram bot commands as markdown files in the commands directory, then reload via the reload_commands tool.`
- Good: `Manage the Telegram bot — read bot token, call Telegram Bot API methods, change bot settings, delete messages, and other bot administration tasks.`
- Bad: `A skill for commands` (too vague, won't match user requests)

## Helper Files

A skill directory can contain additional files that the skill instructions reference:

```
$OPENKITTEN_OPENCODE_DIR/skills/my-skill/
  SKILL.md          # Required — skill definition
  helper.sh         # Optional — shell script
  helper.ts         # Optional — TypeScript helper
  template.md       # Optional — template file
```

Reference helper files in SKILL.md using relative paths (e.g., `./helper.sh`).

## Manual Skill Creation

If you prefer not to use the CLI, create skills directly:

1. Create a directory: `$OPENKITTEN_OPENCODE_DIR/skills/<skill-name>/`
2. Write a `SKILL.md` file inside it with the format above

## Activating New Skills

New skills are NOT available until the system restarts. After creating or installing a skill, call the `reload_extensions` tool to restart and activate it.

The `reload_extensions` tool:
- `message` (required) — a short message to send to the user after the restart completes, e.g. `The "notes" skill is now active.`

The tool notifies the user that a restart is happening, restarts the system, and then sends a confirmation message when ready.

## Skill Name Rules

- Directory name should be kebab-case: lowercase letters, numbers, and hyphens
- Must match the `name` field in the SKILL.md frontmatter

## Built-in Skills (DO NOT overwrite these)

- `custom-commands` — create and manage Telegram bot commands
- `schedules` — create and manage scheduled jobs
- `skill-creator` — this skill
- `telegram-api` — manage the Telegram bot via the Bot API
