# OpenKitten World

This package contains both the canonical product documents and the runnable browser client for OpenKitten World.

## Documents

- [Vision](./VISION.md)
- [Spec](./SPEC.md)
- [Client Strategy](./CLIENT_STRATEGY.md)
- [Visual Direction](./VISUAL_DIRECTION.md)
- [MVP](./MVP.md)
- [Implementation Plan](./IMPLEMENTATION_PLAN.md)

Read the vision first for the product north star.

Read the spec next for the canonical product vocabulary, ontology, interaction model, execution model, invariants, and current implementation boundaries.

Read the client strategy for the current framework choice, presentation strategy, and the planned path from early product focus to long-term immersive world ambitions.

Read the visual direction for the current reference stack, art constraints, character/world/UI guidance, and the intended path from feasible early visuals to a richer long-term atmosphere.

Read the MVP doc for the first vertical slice, scope boundaries, and success criteria.

Read the implementation plan for the recommended Pixi + React client architecture and phased build path.

## Commands

Run these from `packages/world`:

- `bun run dev` starts the local browser client
- `bun run build` creates the production build
- `bun run test` runs the test suite (`--coverage` for coverage report)
