# OpenKitten

Telegram-first AI agent with 75+ AI providers, OS-level sandbox, and built-in capabilities people actually need.

## Vendor

`.vendor/` contains cloned source repos of open-source libraries we depend on. Use them to explore real implementations, understand internals, and verify API behavior.

When you need to understand how a library works internally, ensure its source is cloned and up to date in `.vendor/<name>/`. Examples: `.vendor/opencode/`, `.vendor/grammy/`.

## Bun

Always prefer Bun-native APIs (`Bun.*`) over Node.js equivalents. Use Node.js APIs only when there is no Bun alternative.

## Vitest

100% code coverage across all metrics (statements, branches, functions, lines). Uncovered code is either a potential bug, an indicator of bad code, or naturally unreachable code. Unreachable code should be removed if it can't happen in the real world, or use invariant/assert functions to narrow types and throw.

## Commands

- `bun typecheck` — type check
- `bun compile` — compile binary
- `bun --bun biome check` — lint and format check (`--write` to auto-fix)
- `bun --bun vitest run` — run tests (`--coverage` for coverage report)

## File Convention

Each file has only 1 export (camelCase/PascalCase for export, kebab-case for file name).

## No Hacks

No dirty hacks: no suppression comments (`@ts-ignore`, `@ts-expect-error`, `biome-ignore`, `istanbul ignore`), no hacky type casts (`as unknown as`, `as any`), no non-null assertions (`!`). The only exception is `as never` when mocking in tests.
