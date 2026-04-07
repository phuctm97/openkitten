# OpenKitten World Implementation Plan

## Status

This plan supersedes the earlier Pixi-focused implementation plan.

The current codebase has moved past the earlier `PixiJS + React` scaffold and should now stay on the Phaser baseline described here.

The implementation target from this point forward is:

- Phaser-first on `/`
- React Router for routing
- React pages for non-game routes
- Jotai only as a narrow bridge when the two runtimes need to share state

## Planning Principles

The implementation should preserve these principles:

- the home route is a game experience first
- the core domain model stays independent from rendering details
- Phaser owns the frame loop and primary interaction model on `/`
- React remains available for routes that are not game experiences
- React DOM on `/` should be optional and intentionally minimized

This plan should optimize for product feel, not only for implementation familiarity.

## Immediate Recommendation

Replace the current `Scene`-inside-a-React-shell direction with a fullscreen Phaser route.

Concretely, that means:

- keep the React Router app root neutral
- let `app/routes/index.tsx` create and destroy one `Phaser.Game`
- move world construction into Phaser scenes
- stop designing `/` as a dashboard shell around a renderer

## Recommended Stack

### Core

- `Phaser` for the main `/` runtime
- `React Router` for routing and route composition
- `React` for non-game routes and optional overlays
- `Jotai` for a small renderer-agnostic shared store when needed
- `Bun` workspace tooling for package management and scripts

### Build And Dev Tooling

- Vite through the existing React Router setup
- the current `bun run dev`, `bun run build`, and `bun run test` workflow
- TypeScript build checks through `bun --bun tsc --build`

The build system can remain simple.
The main architectural change is runtime ownership, not bundling strategy.

## Route Strategy

The route model should be:

- `/` for the fullscreen House experience
- additional routes for conventional web flows where appropriate

Examples of likely future non-game routes:

- auth
- onboarding
- settings
- account management
- 404 or fallback routes

These routes should not impose layout assumptions on `/`.

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
- `packages/world/game/`
- `packages/world/game/scenes/`
- `packages/world/game/objects/`
- `packages/world/game/systems/`
- `packages/world/state/`
- `packages/world/domain/`
- `packages/world/fixtures/`
- `packages/world/lib/`
- `packages/world/public/`
- `packages/world/test/`

## Layered Client Architecture

### 1. Domain Layer

The domain layer should hold renderer-agnostic product concepts:

- house
- cats
- goals
- threads
- notices
- memos
- rules
- sessions
- transcript summaries

This layer should not know whether the home route is rendered by Phaser or anything else.

### 2. Fixtures Layer

The early client should still be fixture-driven.

It should provide:

- one demo house
- one human
- two cats
- a few goals and threads
- a small inbox
- one visible active session

The point is to validate the world experience before deeper backend integration.

### 3. Shared State Layer

The shared state layer should stay small and explicit.

It can use Jotai for:

- current inspect target
- selected cat or object
- coarse navigation intent
- maybe summary-level notice or thread state

It should not become a chatty, frame-by-frame coordination bus.

### 4. Phaser Game Layer

This is the primary runtime for `/`.

It should contain:

- boot scene
- house scene
- optional UI scene
- world object placement
- selection and hover behavior
- camera behavior, if needed
- animations and moment-to-moment feedback

The game layer should own:

- frame updates
- pointer and keyboard interaction
- object hit testing
- game-native presentation of the House

### 5. Optional React Surface Layer

React should still exist in the package, but with narrower responsibility.

It should own:

- routes that are not primarily game experiences
- overlays that are clearly better as DOM
- accessibility-heavy forms or settings flows
- supporting product infrastructure around the game route

If an inspect surface can live naturally inside Phaser, prefer that first.

### 6. Integration Boundary

The boundary between Phaser and React should be explicit.

The preferred shape is:

- shared domain types
- a small shared store
- coarse messages or intents

The avoided shape is:

- React controlling the game loop
- Phaser delegating routine UI ownership back to React on every interaction
- permanent dashboard chrome around the game

## Recommended First World Scope

The first meaningful Phaser slice should still be intentionally small:

- one house room or room-like slice
- two visible cats
- one active work station
- one resting cat
- one or two visible house props
- one readable inspect flow

This is enough to answer whether the game-first route feels right.

## Recommended First Data Flow

The clean mental model is:

1. Fixtures produce a stable House state.
2. `app/routes/index.tsx` mounts the fullscreen Phaser container.
3. `app/routes/index.tsx` creates a `Phaser.Game`.
4. Phaser scenes render and interact with the House state.
5. Selection or inspect actions may update a small shared store.
6. Optional game-native or DOM overlays read from that store.

The store should support the experience.
It should not become the experience.

## Suggested Phase Plan

### Phase 1: Phaser Bootstrap

Set up the home route as a runnable fullscreen Phaser client.

Deliverables:

- a fullscreen `/` route with no surrounding app chrome
- a Phaser game bootstrap
- one boot scene and one house scene
- a working dev script
- passing build and test checks

### Phase 2: Fixture-Driven House Slice

Add:

- core client-side domain types
- a fixed demo House scenario
- two cats
- basic room props and placements

Deliverables:

- stable mock data
- readable world layout
- click and hover targets

### Phase 3: Game-Native Inspection Flow

Build the first inspection surfaces.

Deliverables:

- cat inspection surface
- inbox or notice surface
- thread inspection surface
- session transcript surface
- navigation between world selection and inspect state

These surfaces should default to game-native UI.
Use DOM only where it clearly improves the result.

### Phase 4: Human Steering

Add one or two meaningful write actions.

Deliverables:

- add thread comment
- optional add memo
- local state update
- visible House reaction

### Phase 5: World Polish

Improve:

- movement or idle life
- hover feedback
- camera framing
- panel transitions
- readability of the world and HUD

### Phase 6: Real Integration Boundaries

Prepare the client for future executor and backend integration.

Deliverables:

- clearer state ownership boundaries
- replaceable fixture adapter
- preserved separation between world runtime and executor runtime

## Asset Strategy

The first implementation should favor:

- simple but strong silhouettes
- reusable room props
- lightweight 2D animation
- a small number of assets that read clearly at fullscreen size

Avoid over-investing in content volume before the core feel is proven.

## UI Strategy

The default UI strategy on `/` should be:

- world-first
- game-native
- spatially coherent
- calm and readable

This means:

- no permanent browser-style sidebars around the world
- no assumption that every surface should be a DOM card
- no pressure to rebuild every productivity panel before the world feels convincing

If a DOM overlay is used, it should feel like an exception chosen for clarity, not the main composition model.

## Engineering Boundaries To Preserve

The implementation should not depend on:

- a server for the first visual slice
- websocket integration
- authentication
- real executor integration

The first client should be easy to run and easy to reason about locally.

The implementation should also preserve these boundaries:

- Phaser owns the home-route runtime
- React Router owns routing
- the domain model stays renderer-agnostic
- executor integration stays separate from the world client

## First Engineering Milestone

The first convincing milestone is:

`A runnable local Phaser client that opens one House scene fullscreen, shows two cats, and lets the user inspect one active session through a coherent in-world or game-native UI flow.`

If that milestone is not convincing, the team should improve the slice before adding more backend or product complexity.

## What Comes After The First Milestone

After the first milestone, the likely next steps are:

- stronger game-native UI language
- richer cat behavior
- more visible work reactions
- a better steering loop
- backend and executor integration that preserves the game-first route shape

## One-Sentence Summary

Build OpenKitten World first as a fixture-driven fullscreen Phaser House, prove that the game-first route makes the product feel alive and useful, and only then expand the surrounding product surface.
