# OpenKitten

Telegram-first AI agent powered by OpenCode

## Vendor

`.vendor` contains cloned source repos of open-source libraries we depend on. Use them to explore real implementations, understand internals, and verify API behavior.

When you need to understand how a library works internally, ensure its source is cloned and up to date in `.vendor/<name>`. Examples: `.vendor/opencode`, `.vendor/grammy`.

## Bun

Always prefer Bun-native APIs (`Bun.*`) over Node.js equivalents. Use Node.js APIs only when there is no Bun alternative.

## Vitest

100% code coverage across all metrics (statements, branches, functions, lines). Uncovered code is either a potential bug, an indicator of bad code, or naturally unreachable code. Unreachable code should be removed if it can't happen in the real world, or use invariant/assert functions to narrow types.

## Commands & Scripts

- `bun --bun tsc --build` — TypeScript check
- `bun --bun biome check` — linter & formatter check (`--write` to auto-fix)
- `bun run --workspaces --if-present test --coverage` — run tests (`--coverage` to report coverage)

## Files & Exports

Each file has only 1 export (camelCase/PascalCase for export name, kebab-case for file name).

## No Hacks

No dirty hacks: no suppression comments (`@ts-ignore`, `@ts-expect-error`, `biome-ignore`, `istanbul ignore`), no hacky type casts (`as unknown as`, `as any`), no non-null assertions (`!`). The only exception is `as never` when mocking in tests.
