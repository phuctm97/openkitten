# OpenKitten World Implementation Plan

## Status

This plan describes the intended implementation path for OpenKitten World.

The implementation target is:

- one app on `world.openkitten.com`
- separate `app` and `game` route trees
- one shared domain, state, and action layer
- utility proven in app mode first
- game mode built as a real world surface, not a static mockup

## Planning Principles

The implementation should preserve these principles:

- the shared core comes first
- app mode proves usefulness early
- game mode is held to a real quality bar
- the core domain model stays independent from rendering details
- app mode and game mode stay separate at the presentation layer
- the team should iterate in public through small, demoable slices

This plan should optimize for usefulness, momentum, and honest feedback rather than long stealth branches.

## Immediate Focus

Start with the shared core and the app-mode slice, while shaping the codebase so game mode can grow over the same model.

Concretely, that means:

- define domain types and fixtures first
- define shared actions and selectors early
- build useful app routes before chasing game polish
- keep a clean boundary where game mode can later plug in

## Recommended Stack

### Core

- `React Router` for routing and route composition
- `React` for app mode and shared web infrastructure
- a real game runtime for game mode, likely `Phaser`
- `Bun` workspace tooling for package management and scripts

### Build And Dev Tooling

- Vite through the existing React Router setup
- the current `bun run dev`, `bun run build`, and `bun run test` workflow
- TypeScript build checks through `bun --bun tsc --build`

The build system can remain simple.
The main architectural work is separating the shared core from the two renderers.

## Route Strategy

The route model should be mode-first.

Examples:

- `/app/houses/:houseId`
- `/game/houses/:houseId`

Likely supporting routes later:

- `/app/houses`
- `/game/houses`
- `/app/settings`
- `/game/settings`

These routes should share product state without forcing one mode's layout or runtime assumptions onto the other.

## Suggested Package Layout

The package should likely grow toward something like:

- `packages/world/README.md`
- `packages/world/VISION.md`
- `packages/world/SPEC.md`
- `packages/world/CLIENT_STRATEGY.md`
- `packages/world/VISUAL_DIRECTION.md`
- `packages/world/MVP.md`
- `packages/world/IMPLEMENTATION_PLAN.md`
- `packages/world/package.json`
- `packages/world/react-router.config.ts`
- `packages/world/vite.config.ts`
- `packages/world/vitest.config.ts`
- `packages/world/app/`
- `packages/world/app/routes/app/`
- `packages/world/app/routes/game/`
- `packages/world/components/`
- `packages/world/domain/`
- `packages/world/state/`
- `packages/world/actions/`
- `packages/world/selectors/`
- `packages/world/game/`
- `packages/world/game/scenes/`
- `packages/world/game/objects/`
- `packages/world/game/systems/`
- `packages/world/fixtures/`
- `packages/world/assets/`
- `packages/world/test/`

The exact folder names can evolve, but the conceptual split matters:

- shared core
- app renderer
- game renderer

## Layered Client Architecture

### 1. Domain Layer

The domain layer should hold renderer-agnostic product concepts:

- houses
- cats
- goals
- threads
- notices
- memos
- rules
- sessions
- transcript summaries

This layer should not know whether anything is rendered in app mode or game mode.

### 2. Actions And Selectors Layer

This layer should define:

- shared reads
- shared writes
- view-model shaping that both modes can consume
- permission and validation logic

This is where the product becomes one system instead of two clients glued together later.

### 3. Fixtures Layer

The early client should still be fixture-driven.

It should provide:

- one demo house
- one human
- two cats
- a few goals and threads
- a small inbox
- one visible active session

The point is to validate the shared product model before deeper integration.

### 4. App Mode Layer

This is the first useful renderer.

It should contain:

- house overview surfaces
- inbox views
- thread views
- cat and session inspection
- steering actions

App mode should own:

- dense information layout
- conventional form flows
- fast navigation
- accessibility-heavy interactions

### 5. Game Mode Layer

This is the second renderer over the same house state.

It should contain:

- room composition
- cats and props in world space
- hit testing and interaction
- camera behavior
- animation and world-specific feedback
- modular construction that supports customization later

Game mode should own:

- frame updates
- pointer and keyboard interaction
- world-native inspection
- environmental presentation

### 6. Mode-Specific Presentation State

Each mode may keep local state that the other mode does not need.

Examples:

- app-mode panel state
- game-mode camera state
- hover and drag state
- animation timing
- room layout and prop placement

This state should stay local unless it becomes part of the shared product meaning.

## Recommended First Data Flow

The clean mental model is:

1. Fixtures produce a stable house state.
2. Shared selectors shape the data for presentation.
3. `/app/...` routes render useful productivity views over that state.
4. `/game/...` routes render the same house as a place.
5. Shared actions mutate the same underlying model.
6. Both modes re-read the same source of truth.

The shared core should support the experience.
It should not be replaced by two renderer-specific shadow models.

## Public Iteration Strategy

OpenKitten World should be built in public through very small slices.

The preferred loop is:

1. Choose one small product or world capability.
2. Ship a visible version quickly.
3. Share a clip, screenshot, or short write-up.
4. Ask one focused question.
5. Fold feedback into the next slice immediately.

Good public slices:

- a better thread view
- a clearer cat inspection card
- the first inbox
- the first room composition pass
- the first modular wall system
- the first cat idle animation

Avoid:

- long private branches
- giant reveals
- waiting for an entire mode to feel complete before showing progress

## Suggested Phase Plan

### Phase 1: Shared Core

Define the product model that both modes will share.

Deliverables:

- domain types
- shared actions
- shared selectors
- one demo house fixture
- passing build and test checks

### Phase 2: App Mode MVP

Build the first useful app-mode slice.

Deliverables:

- `/app/houses/:houseId`
- inbox view
- thread view
- cat inspection
- session view
- one steering action

### Phase 3: First Game Slice

Build the first honest game-mode slice over the same house.

Deliverables:

- `/game/houses/:houseId`
- one room slice
- two visible cats
- modular room construction
- basic motion and interaction
- one readable inspect flow

### Phase 4: Game Quality Bar

Raise the world from promising to believable.

Deliverables:

- better cat state readability
- clearer hover and click feedback
- stronger layering and depth
- prop grammar for house surfaces
- improved transitions and camera behavior

### Phase 5: Mode Continuity

Tighten the relationship between the two modes.

Deliverables:

- easy mode switching for the same house
- stronger visual continuity
- more shared actions exposed in both modes
- clearer user understanding that both views reflect one system

### Phase 6: Real Integration Boundaries

Prepare the client for future backend and executor integration.

Deliverables:

- replaceable fixture adapter
- clearer persistence boundaries
- preserved separation between executor runtime and product rendering

## Asset Strategy

The first implementation should favor:

- modular room pieces instead of one flattened shell
- strong silhouettes
- reusable props
- a small set of reusable cat variations
- lightweight but readable 2D animation

Avoid over-investing in asset volume before the interaction grammar is proven.

## UI Strategy

The default UI strategy should be:

- app mode is useful first
- game mode is world-first
- both modes stay calm and readable
- neither mode is forced into the other's shell

That means:

- no requirement that app-mode cards become game-mode panels
- no requirement that game-mode windows become app-mode layouts
- no pressure to fake a world before it is ready

## Engineering Boundaries To Preserve

The implementation should not depend on:

- a server for the first shared-core slice
- websocket integration
- authentication
- real executor integration

The first client should be easy to run and easy to reason about locally.

The implementation should also preserve these boundaries:

- the domain model stays renderer-agnostic
- app mode and game mode share business logic
- app mode and game mode keep presentation logic separate
- executor integration stays separate from world rendering

## First Engineering Milestone

The first convincing milestone is:

`A shared-core local client where /app/houses/:houseId is already useful for review and steering, and /game/houses/:houseId already makes that same house feel like the beginning of a real place instead of a static illustration.`

If that milestone is not convincing, the team should improve the slice before adding more complexity.

## What Comes After The First Milestone

After the first milestone, the likely next steps are:

- stronger app-mode workflows
- richer cat behavior
- more visible work reactions
- better customization primitives
- backend and executor integration that preserve the shared core

## One-Sentence Summary

Build OpenKitten World first as one shared-core product with useful `app` routes and honest `game` routes, then keep raising both sides in public without letting either fork the underlying system.
