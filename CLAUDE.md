# OpenKitten

Telegram-first AI agent with 75+ AI providers, OS-level sandbox, and built-in capabilities people actually need.

## Stack

Effect for the concurrent service kernel (bot, event streams, state, retries, subprocess supervision, etc.). Plain Bun for one-shot scripts (`up`, `down`, shell commands, etc.). Bridge with `Effect.promise()`.

Effect compiler errors mean you're not handling something — fix it properly, don't hack around it. If the Effect code is becoming too verbose or requires hacks to test, it's likely a better fit for plain Bun.

## Vendor

`.vendor/` contains cloned source repos of open-source libraries we depend on. Use them to explore real implementations, understand internals, and verify API behavior.

When you need to understand how a library works internally, ensure its source is cloned and up to date in `.vendor/<name>/`. Examples: `.vendor/effect/`, `.vendor/opencode/`, `.vendor/grammy/`.

## Effect

Always consult effect-solutions before writing Effect code.

1. `effect-solutions list` — see available guides
2. `effect-solutions show <topic>...` — get patterns (supports multiple topics)

Never guess at Effect patterns — consult effect-solutions and the source code first.

## Bun

Always prefer Bun-native APIs (`Bun.*`) over Node.js equivalents. Use Node.js APIs only when there is no Bun alternative.

## Vitest

Always aim for the highest possible code coverage. Don't test code that is non-reproducible, causes side effects during execution, or requires overly complex/verbose mocking.

## Commands

- `bun typecheck` — type check
- `bun compile` — compile binary
- `bun --bun biome check` — lint and format check (`--write` to auto-fix)
- `bun --bun vitest run` — run tests (`--coverage` for coverage report)

