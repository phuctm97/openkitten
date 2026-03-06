# OpenKitten

Telegram-first AI agent with 75+ AI providers, OS-level sandbox, and built-in capabilities people actually need.

## Stack

Effect for the concurrent service kernel (bot, event streams, state, retries, subprocess supervision). Plain Bun for one-shot scripts (`up`, `down`, shell commands). Bridge with `Effect.promise()`.

Effect compiler errors mean you're not handling something — fix it properly, don't hack around it. If the Effect code is becoming too verbose or requires hacks to test, it's likely a better fit for plain Bun.

## Effect

Always consult effect-solutions before writing Effect code.

1. `effect-solutions list` — see available guides
2. `effect-solutions show <topic>...` — get patterns (supports multiple topics)
3. `.reference/effect/` — real implementations for API exploration

Never guess at Effect patterns — check the guide first.

## Bun

Always prefer Bun-native APIs (`Bun.*`) over Node.js equivalents. Use Node.js APIs only when there is no Bun alternative.
