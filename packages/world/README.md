# OpenKitten World

This package contains both the canonical product documents and the browser client for OpenKitten World.

## Status

OpenKitten World is planned and built as a Phaser-first browser client:

- `/` is a fullscreen Phaser experience
- React Router owns routing
- non-game routes can stay conventional React pages
- React DOM on `/` is optional and secondary
- Jotai may be used as a narrow bridge between Phaser and React when needed

These docs assume that architecture throughout.

## Documents

- [Vision](./VISION.md)
  The product north star and the experience OpenKitten World should ultimately create.
- [Spec](./SPEC.md)
  The canonical product vocabulary, domain model, interaction model, and implementation boundaries.
- [Client Strategy](./CLIENT_STRATEGY.md)
  Why Phaser is the right runtime for the home route and how it should relate to React.
- [Visual Direction](./VISUAL_DIRECTION.md)
  The visual, spatial, and UI principles for a fullscreen game-first product.
- [MVP](./MVP.md)
  The first vertical slice that should prove the product direction.
- [Implementation Plan](./IMPLEMENTATION_PLAN.md)
  The recommended package layout, architecture, and phased path for the Phaser-first client.

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
