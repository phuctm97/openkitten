# OpenKitten World

This package contains both the canonical product documents and the web client for OpenKitten World.

OpenKitten World is the async multi-agent platform that sits alongside:

- the root and `www` website, which remain SEO and marketing surfaces
- `@openkitten/cli`, which remains the Telegram bot and sync chat surface

## Status

OpenKitten World is planned as one product on `world.openkitten.com` with two modes:

- `app` mode for fast, conventional productivity workflows
- `game` mode for the living House experience

Both modes operate on the same core product model:

- `House`
- `Cat`
- `Goal`
- `Thread`
- `Notice`
- `Memo`
- `Rule`
- `Session`
- the rest of the shared House state

The shared core is the product.
The two modes are different renderers and interaction styles over that same core.

The implementation plan assumes a capability ladder built in this order:

1. `Thin substrate`
2. `Houses`
3. `Cats`
4. `Threads + comments`
5. `Inbox + notices`
6. `Executors`
7. `Sessions + transcripts`
8. `Direction + steering`
9. `Activities + history`
10. `Artifacts + house surfaces`
11. `Game-specific house identity`

Each capability should be delivered in this sequence:

1. backend
2. app mode
3. game mode

Game mode may keep extra state for:

- camera and movement
- room layout and prop placement
- animation and interaction timing
- house customization and other world-specific presentation

But it must not fork the core domain model or business actions.

These docs assume route shapes like:

- `/app/houses/:houseId`
- `/game/houses/:houseId`

## Documents

- [Vision](./VISION.md)
  The product north star and the reason OpenKitten World should exist as both a useful tool and a lovable place.
- [Spec](./SPEC.md)
  The canonical vocabulary, domain model, mode model, and implementation boundaries.
- [Client Strategy](./CLIENT_STRATEGY.md)
  Why OpenKitten World should be one app with separate `app` and `game` route trees over a shared core.
- [Visual Direction](./VISUAL_DIRECTION.md)
  The visual principles for a useful app mode and a polished, complete game mode.
- [MVP](./MVP.md)
  The capability ladder, public milestones, and the first shareable and tryable slices.
- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
  The delivery model, capability order, architecture boundaries, and build-in-public loop.

Recommended reading order:

1. [Vision](./VISION.md)
2. [Spec](./SPEC.md)
3. [Client Strategy](./CLIENT_STRATEGY.md)
4. [Visual Direction](./VISUAL_DIRECTION.md)
5. [MVP](./MVP.md)
6. [Implementation Plan](./IMPLEMENTATION_PLAN.md)

## Commands

Run these from `packages/world`:

- `bun run dev` starts the local browser client
- `bun run build` creates the production build
- `bun run test` runs the test suite
- `bun --bun tsc --build` runs the TypeScript build check
