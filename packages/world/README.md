# OpenKitten World

This package contains both the canonical product documents and the browser client for OpenKitten World.

## Status

These docs reflect the current direction adopted after evaluating the earlier `PixiJS + React` phase-1 prototype:

- `/` should become a fullscreen Phaser experience
- React Router should still own routing
- non-game routes can stay conventional React pages
- React DOM on `/` should be optional and secondary
- Jotai may be used as a narrow bridge between Phaser and React when needed

The current implementation has moved on from that earlier Pixi experiment and now targets the Phaser route described below.

## Documents

- [Vision](./VISION.md)
  The product north star and the experience OpenKitten World should ultimately create.
- [Spec](./SPEC.md)
  The canonical product vocabulary, domain model, interaction model, and implementation boundaries.
- [Client Strategy](./CLIENT_STRATEGY.md)
  Why the client direction changed and why Phaser is now the preferred home-route runtime.
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
