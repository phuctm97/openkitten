# OpenKitten World Implementation Plan

## Status

This document translates the current OpenKitten World vision, spec, client strategy, visual direction, and MVP into a practical implementation plan.

It is meant to answer:

- how the first world client should be structured
- how `PixiJS + React` should be used together
- how to scope the first implementation safely
- what phases should come first
- what engineering decisions should be made now versus deferred

This is a build plan for the first real client implementation, not the final system architecture for the whole product.

## Planning Principles

The implementation should optimize for:

- proving the product quickly
- keeping the House model intact
- avoiding premature game-engine abstraction
- preserving future room for richer immersion
- staying close to the team's TypeScript and React strengths

The implementation should not optimize for:

- maximum engine completeness
- premature backend complexity
- speculative scale concerns before the core client experience is proven

## Immediate Recommendation

The first implementation should start inside the existing `packages/world` package.

That means:

- keep the current docs in `packages/world`
- add actual application code to the same package
- grow it into the first world client

This keeps the product thinking and implementation close together at the start.

If the codebase grows large later, it can be split.
But that is not necessary before the first slice exists.

## Recommended Stack

### Core

- `TypeScript`
- `React`
- `PixiJS`
- `@pixi/react`

### Recommended Build And Dev Tooling

- a browser-oriented dev/build tool such as `Vite`
- Bun workspace tooling for package management and scripts

The exact build tool can still be chosen during scaffolding, but the implementation should preserve this principle:

- the client should behave like a modern web application first
- the world rendering should sit naturally inside that model

## Key Architectural Decision

The first implementation should use:

- `React` as the app and UI composition layer
- `Pixi` as the world rendering and interaction layer

That means the first client should be understood as:

- a world-first product presentation
- built on top of an application-first state model

This is the most important architecture decision in the plan.

## UI Strategy For The First Slice

For the MVP and early implementation, the recommended strategy is:

- use `Pixi` for the House world and lightweight in-world affordances
- use `React` for dense, text-heavy, productivity-heavy panels

This means:

- cats
- rooms
- props
- world selection states
- simple in-world overlays

belong naturally in the Pixi layer

while:

- inbox panels
- thread panels
- transcript panels
- cat detail panels
- text inputs

should prioritize readability and speed of implementation first

This is a recommendation for the first implementation, not a permanent limitation.
The state model should still make it possible to evolve toward more in-world UI later if that becomes valuable.

## Why This Hybrid Layering Is Recommended

It best serves the actual product:

- OpenKitten World is still a serious productivity tool
- many surfaces are text-heavy
- long-form readability matters
- writing comfort matters
- the product should feel good before it feels fully diegetic

This also keeps the first implementation focused on what is unique:

- the House
- the cats
- the world view
- the interaction model

rather than rebuilding a custom text-heavy UI system too early.

## Suggested Package Layout

The first implementation should likely grow `packages/world` into something like:

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
- `packages/world/hooks/`
- `packages/world/components/`
- `packages/world/domain/`
- `packages/world/fixtures/`
- `packages/world/state/`
- `packages/world/scene/`
- `packages/world/panels/`
- `packages/world/lib/`
- `packages/world/test/`
- `packages/world/public/`

The exact folder split can change, but the conceptual layering should stay stable.

## Layered Client Architecture

### 1. Domain Layer

The domain layer should mirror the world spec closely.

It should define the core client-side shapes for:

- House
- Cat
- Goal
- Thread
- Comment
- Activity
- Notice
- Session

This layer should stay close to the product vocabulary.
It should not be polluted with rendering-specific concerns.

### 2. Fixtures Layer

The first client should rely on fixtures and mocked scenarios.

This layer should provide:

- the default demo House
- two demo Cats
- example Threads
- example Notices
- one active Session transcript

Fixtures are important because they let the team prove the product before backend work and executor work exist.

### 3. State Layer

The state layer should hold the live client state for:

- House data
- selected cat
- selected thread
- opened panel state
- transcript playback state
- local interaction results

The state model should be:

- app-first
- serializable
- independent from rendering details

The state layer should be able to drive:

- a Pixi House view
- React panels
- future alternate presentation modes

### 4. World Presentation Layer

The world layer should map House state into visible world objects.

It should be responsible for:

- room layout
- cat placement
- object placement
- hover and selection feedback
- movement and idle animation
- world-level transitions

This layer should not own the product state.
It should render and interact with product state.

### 5. Panel Layer

The panel layer should render the text-heavy surfaces:

- cat detail
- inbox
- thread view
- session transcript

It should be product-clear and readable first.
Visual richness can grow later.

### 6. Interaction Layer

The interaction layer should connect:

- world clicks
- panel opens
- selection changes
- transcript playback
- comment submission
- memo submission later

This is the bridge between the world and the actual work surfaces.

## Recommended First World Scope

The first world implementation should be:

- one static house scene
- one visible room or house slice
- no scrolling map
- no multi-room traversal

This is intentional.

The first question is not:

- can we build a big world?

It is:

- can one small House scene already feel good, useful, and alive?

## Recommended First World Objects

The first scene should include:

- one active cat station
- one idle cat area
- one inbox/mail object
- one whiteboard object
- one cabinet object

The whiteboard and cabinet can initially be:

- mostly visual
- lightly inspectable

They do not need deep product behavior in the first slice.

## Recommended First Data Flow

The first implementation should use:

- local fixtures as the source of truth
- local timers to simulate transcript updates
- local state updates when the user comments or opens notices

That means the first build should not depend on:

- a server
- a websocket
- executor integration
- authentication

This makes the first client much easier to reason about.

## Suggested Phase Plan

### Phase 1: Package Scaffolding

Set up the world package as a runnable browser client.

Deliverables:

- browser entrypoint
- React bootstrapping
- Pixi stage bootstrapping
- working dev script

### Phase 2: Domain And Fixtures

Add:

- core client-side domain types
- a fixed demo House scenario
- fixture-driven cats, threads, notices, and transcript

Deliverables:

- stable mock data
- enough domain structure to build the first slice

### Phase 3: House Scene

Build the first House scene.

Deliverables:

- one room or house slice
- two visible cats
- world object placements
- selection and hover states
- simple idle animation

### Phase 4: Panels And Navigation

Build the basic panels.

Deliverables:

- cat detail panel
- inbox panel
- thread panel
- session transcript panel
- navigation between world selection and panel state

### Phase 5: Mock Interactivity

Add one or two meaningful write actions.

Deliverables:

- add thread comment
- optional add memo
- local state update
- visible House reaction

### Phase 6: Polish The Vertical Slice

Improve:

- panel transitions
- hover feedback
- cat presence
- transcript feel
- world clarity

This phase is about making the slice feel real, not feature-rich.

## Recommended Visible Reactions

The MVP should include a few visible reactions that connect product actions back into the world.

Examples:

- when a thread is opened, the active cat and/or work area highlight
- when a comment is added, the relevant thread state updates immediately
- when an inbox notice is opened, the related cat or thread becomes visually emphasized
- when the mock transcript updates, the active cat visibly reacts

These are important because they make the House feel connected rather than split into unrelated panels.

## Asset Strategy

The first implementation should keep assets intentionally simple.

Recommended early asset categories:

- house background
- a few room/station props
- two cat bodies
- a small set of facial or pose variants
- simple accessory layers
- icons for inbox, thread, cabinet, whiteboard

The asset strategy should assume:

- heavy reuse
- AI-assisted generation and iteration
- simple, stylized forms
- limited animation states

## Animation Strategy

The first implementation should target:

- cat idle animation
- one working loop
- one resting loop
- subtle hover feedback
- simple panel transitions
- light transcript/world feedback

The first implementation should avoid:

- large cinematic sequences
- complex pathfinding presentation
- highly bespoke animation for every action

## Engineering Boundaries To Preserve

The implementation must preserve the stable boundaries already set in the spec:

- domain state should not depend on rendering
- cats and House concepts should not be reduced to generic engine objects
- executor integration should remain separate from the world client
- cat memory implementation should remain replaceable
- notices, threads, and sessions should stay product-native concepts

## Deferred Decisions

The following decisions should remain open until after the MVP exists:

- exact backend architecture
- exact persistence layer
- exact realtime transport
- real executor integration details
- whether more of the UI should move into Pixi later
- deeper world traversal model
- multi-house navigation
- multi-human collaboration flows

## First Engineering Milestone

The first engineering milestone should be:

`A runnable local world client that opens one House scene, shows two cats, and lets the user inspect one active session through a readable panel flow.`

If that milestone is not convincing, the team should improve the slice before adding more backend or world complexity.

## What Comes After The First Milestone

Only after the first milestone feels good should the team move to:

- stronger world polish
- real data loading
- real notice generation
- real thread persistence
- real executor/session wiring

The first implementation should earn complexity gradually.

## One-Sentence Summary

Build OpenKitten World first as a fixture-driven, single-house, Pixi-rendered client with React-managed product surfaces, and prove that one small House can already feel alive, readable, and useful before expanding the system.
