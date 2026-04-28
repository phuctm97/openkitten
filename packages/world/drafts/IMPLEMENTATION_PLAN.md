# OpenKitten World Implementation Plan

## Status

This plan describes the intended implementation path for OpenKitten World.

The implementation target is:

- one app on `world.openkitten.com`
- separate `app` and `game` route trees
- one shared domain, state, and action layer
- a capability ladder delivered `backend -> app -> game`
- public iteration as early and as often as possible

## Planning Principles

The implementation should preserve these principles:

- build the shared core one capability at a time
- prove usefulness in app mode as early as possible
- force game mode to earn its place through real quality
- keep backend, app, and game tied to the same capability
- avoid large stealth phases whenever possible
- optimize for learnings, not just architecture neatness

This plan should optimize for usefulness, momentum, and honest feedback rather than long invisible infrastructure work.

## Delivery Model

The preferred delivery pattern for every capability is:

1. backend
2. app mode
3. game mode

This order is intentional:

- backend makes the capability real
- app mode makes it usable
- game mode makes it embodied and shareable

The goal is not to finish all backend work before anything public exists.
The goal is to build the minimum backend needed for one capability, then expose that capability immediately through app mode and game mode.

## Capability Order

The preferred top-level capability ladder is:

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

This order should follow product dependency order, not just technical dependency order.

In particular:

- `Threads + comments` should arrive before user-facing `Activities`
- low-level file storage primitives may exist inside `Thin substrate`
- user-facing files, cabinets, and whiteboards should arrive later as product surfaces
- `Executor` should be explicit instead of being buried inside sessions

## Why This Order

### Thin Substrate

This is the minimum invisible foundation.

It should include:

- auth
- identity
- permissions and membership primitives
- IDs and timestamps
- blob or file storage primitives
- minimal event or job plumbing

This should stay intentionally thin.
It is support work, not a public product phase.

### Houses

This is the first real product container.

It should establish:

- house identity
- house membership
- opening a house
- routing into the same house in both modes

### Cats

This is the first actor layer.

It should establish:

- cat identity
- cat state
- cat-to-house relation
- visible cat presence in both modes
- an early default executor reference if needed

This is also the first strong social-media layer.

### Threads + Comments

This is the first durable work loop.

It should establish:

- thread identity and lifecycle
- comment writing and reading
- understanding work in context
- the first meaningful tryable slice

### Inbox + Notices

This is the first return loop.

It should establish:

- attention routing
- a reason to revisit the product
- a way to surface what changed or needs review

### Executors

This is the first runtime substrate for real cat work.

It should establish:

- executor identity or registry
- cat-to-executor linkage
- dispatch or wake primitives
- the path toward real sessions

### Sessions + Transcripts

This is the first strong observability loop.

It should establish:

- session inspection
- readable transcript output
- understanding what a cat is doing
- the first strong invite-only alpha gate

### Direction + Steering

This is the first deep async control layer.

It should establish:

- goals
- memos
- rules
- a clear human steering loop

This is where OpenKitten becomes much more than observation alone.

### Activities + History

This layer should be split internally:

- internal event recording can begin earlier
- user-facing activity or history surfaces should become prominent only once enough meaningful events exist

### Artifacts + House Surfaces

This is the first layer where the house’s durable work surfaces become real product surfaces.

It should include:

- files as a user-facing product surface
- cabinets
- whiteboards

### Game-Specific House Identity

This is where game mode becomes deeply ownable.

It should include:

- modular room construction
- props and layering
- layout persistence
- customization
- richer house identity

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

The main architectural work is not bundling.
It is keeping the capability ladder coherent across backend, app, and game.

## Route Strategy

The route model should remain mode-first.

Examples:

- `/app/houses/:houseId`
- `/game/houses/:houseId`

Likely supporting routes later:

- `/app/houses`
- `/game/houses`
- `/app/settings`
- `/game/settings`

The routing model should support one product with two renderers, not force the two modes into one compromised shell.

## Suggested Package Layout

This package contains the docs and the web client.
Backend implementation may live outside `packages/world/packages/spa`, but the delivery model should still be reflected in the client architecture.

The package should likely grow toward something like:

- `packages/world/drafts/README.md`
- `packages/world/drafts/VISION.md`
- `packages/world/drafts/SPEC.md`
- `packages/world/drafts/CLIENT_STRATEGY.md`
- `packages/world/drafts/VISUAL_DIRECTION.md`
- `packages/world/drafts/MVP.md`
- `packages/world/drafts/IMPLEMENTATION_PLAN.md`
- `packages/world/packages/spa/package.json`
- `packages/world/packages/spa/react-router.config.ts`
- `packages/world/packages/spa/vite.config.ts`
- `packages/world/packages/spa/vitest.config.ts`
- `packages/world/packages/spa/app/`
- `packages/world/packages/spa/app/routes/app/`
- `packages/world/packages/spa/app/routes/game/`
- `packages/world/packages/spa/components/`
- `packages/world/packages/spa/domain/`
- `packages/world/packages/spa/state/`
- `packages/world/packages/spa/actions/`
- `packages/world/packages/spa/selectors/`
- `packages/world/packages/spa/game/`
- `packages/world/packages/spa/game/scenes/`
- `packages/world/packages/spa/game/objects/`
- `packages/world/packages/spa/game/systems/`
- `packages/world/packages/spa/fixtures/`
- `packages/world/packages/spa/assets/`
- `packages/world/packages/spa/test/`

The important conceptual split is:

- shared capability core
- app renderer
- game renderer

## Layered Client Architecture

### 1. Domain Layer

The domain layer should hold renderer-agnostic product concepts:

- houses
- cats
- executors
- threads
- comments
- notices
- sessions
- transcripts
- goals
- memos
- rules
- activities
- files and house surfaces

This layer should not know whether anything is rendered in app mode or game mode.

### 2. Actions And Selectors Layer

This layer should define:

- shared reads
- shared writes
- permission and validation logic
- view-model shaping that both modes can consume

This is where the product becomes one system instead of two loosely related clients.

### 3. Fixtures Layer

The early client should still be fixture-driven when real integrations are not needed yet.

Fixtures should be capability-aware:

- the house fixture evolves as the ladder evolves
- app mode and game mode should consume the same fixture
- fixtures should support public demos and early feedback, not just local development

### 4. App Mode Layer

This is the first useful renderer for most capabilities.

App mode should own:

- dense information layout
- conventional editing flows
- fast navigation
- accessibility-heavy interactions

### 5. Game Mode Layer

This is the second renderer over the same state.

Game mode should own:

- spatial presentation
- camera and movement
- hit testing and animation
- world-native inspection
- environmental identity

### 6. Mode-Specific Presentation State

Each mode may keep local state that the other does not need.

Examples:

- app-mode panel state
- game-mode camera state
- hover and drag state
- animation timing
- room layout and prop placement

This state should stay local unless it becomes part of the shared product meaning.

## Recommended Data Flow Per Capability

The clean mental model is:

1. The backend model defines the capability.
2. Shared actions and selectors expose the capability.
3. App mode makes the capability useful.
4. Game mode makes the same capability visible or embodied.
5. Public feedback informs the next refinement before the team climbs higher.

The shared core should support the experience.
It should not be replaced by separate app-mode and game-mode shadow models.

## Public Iteration Strategy

OpenKitten World should be built in public through small slices that are either:

- `shareable`
- `tryable`

Sometimes a slice will be both.
Often it will be one before it becomes the other.

### Shareable Slice Rules

A good shareable slice should:

- read clearly in under 15 seconds
- show one visible capability, not five
- have one focused message
- be honest about what is real

Good examples:

- first real cat states
- one notice flowing into a house
- one transcript inspection flow
- one modular room system

### Tryable Slice Rules

A good tryable slice should:

- let someone complete one meaningful loop in under 10 minutes
- ask one focused feedback question
- include one real state change
- be stable enough that failure is informative

Good examples:

- read and reply to one thread
- inspect one session
- review one inbox
- add one memo and see what changed

### Feedback Stages

The preferred public stages are:

1. social progress updates
2. friendly testers
3. invite-only alpha
4. broader public alpha

The likely earliest thresholds are:

- first social progress: `Cats`
- first meaningful tryable slice: `Threads + comments`
- first strong invite-only alpha: `Sessions + transcripts`
- first distinctly OpenKitten loop: `Direction + steering`

## Suggested Phase Plan

### Phase 0: Thin Substrate

Deliver:

- minimal auth and identity
- permissions primitives
- membership primitives
- IDs and storage primitives

### Phase 1: Houses

Deliver:

- house model
- open/select house
- route the same house in both modes

### Phase 2: Cats

Deliver:

- cat model
- visible cat state
- first cat presence in app mode and game mode

### Phase 3: Threads + Comments

Deliver:

- thread model
- comment model
- first meaningful app-mode work loop
- first friendly tryable slice

### Phase 4: Inbox + Notices

Deliver:

- notice model
- inbox review
- stronger return loop

### Phase 5: Executors

Deliver:

- executor model
- cat-to-executor linkage
- dispatch or wake primitives

### Phase 6: Sessions + Transcripts

Deliver:

- session inspection
- transcript reading
- first strong invite-only alpha

### Phase 7: Direction + Steering

Deliver:

- goals
- memos
- rules
- first distinctly OpenKitten async control loop

### Phase 8: Activities + History

Deliver:

- meaningful event history
- readable activity surfaces once enough signal exists

### Phase 9: Artifacts + House Surfaces

Deliver:

- files as a product surface
- cabinets
- whiteboards

### Phase 10: Game-Specific House Identity

Deliver:

- modular construction
- props and layering
- layout persistence
- richer world customization

## Asset Strategy

The first implementation should favor:

- strong silhouettes
- reusable cat variations
- modular room pieces
- props that can recur across many houses
- lightweight but readable animation

Avoid investing in huge asset volume before the capability loop is clear.

## UI Strategy

The default UI strategy should be:

- app mode proves usefulness first
- game mode proves identity continuously
- both modes remain calm and readable
- neither mode is forced into the other’s shell

That means:

- no fake world before the underlying capability is real
- no generic app shell leaking into game mode
- no demand for feature parity at every layer before public sharing begins

## Engineering Boundaries To Preserve

The implementation should preserve these boundaries:

- the domain model stays renderer-agnostic
- app mode and game mode share business logic
- app mode and game mode keep presentation logic separate
- executor integration stays separate from renderer-specific code

The implementation should avoid:

- endless invisible foundation work
- duplicated business logic across modes
- static world slices that carry no real product meaning
- introducing user-facing history before there is enough history to show

## First Convincing Milestones

The first convincing milestones are:

- a cat slice people want to share
- a thread slice people can actually try
- a session slice people can actually inspect
- a steering slice that makes OpenKitten feel unique

If those milestones are not convincing, the team should improve the current layer before climbing much higher.

## One-Sentence Summary

Build OpenKitten World as a public capability ladder where each layer is made real in the backend, useful in app mode, and embodied in game mode before the team moves up to the next layer.
