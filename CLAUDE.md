# OpenKitten

Telegram-first AI agent with 75+ AI providers, OS-level sandbox, and built-in capabilities people actually need.

## Bun

Always prefer Bun-native APIs (`Bun.*`) over Node.js equivalents. Use Node.js APIs only when there is no Bun alternative.

## Vitest

100% code coverage across all metrics (statements, branches, functions, lines). Uncovered code is either a potential bug, an indicator of bad code, or naturally unreachable code. Unreachable code should be removed if it can't happen in the real world, or use invariant/assert functions to narrow types and throw.

## Commands

- `bun typecheck` — type check
- `bun compile` — compile binary
- `bun --bun biome check` — lint and format check (`--write` to auto-fix)
- `bun --bun vitest run` — run tests (`--coverage` for coverage report)
