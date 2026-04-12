# OpenKitten World MVP

## Status

This document defines the MVP target for OpenKitten World.

The MVP assumes:

- one app on `world.openkitten.com`
- a shared core underneath both modes
- `app` mode proving usefulness first
- `game` mode proving that the House can become a real, polished surface

## MVP Goal

The MVP should prove that OpenKitten World can become:

- a real async productivity system
- centered on Houses and Cats
- useful in app mode
- promising in game mode

The MVP is successful if a user can work in app mode, switch to game mode for the same house, and feel:

- the core work model is understandable
- the house and cats are coherent across both modes
- the game direction is intriguing rather than fake
- the product is worth returning to

## Core Question

The MVP is mainly trying to answer this question:

`Can one shared House-and-Cats core support a genuinely useful app mode now and a genuinely compelling game mode later?`

## MVP Product Promise

The MVP does not need to prove every part of the full product.

It only needs to prove these things:

1. The shared core model is useful enough to carry real async work concepts.
2. `App` mode can support serious review, inspection, and steering.
3. `Game` mode can make the same house feel alive instead of merely illustrated.
4. The same house state can be understood across both modes.
5. The product becomes more compelling because of the House model, not in spite of it.

## MVP Structure

The MVP should be split into two linked slices:

### 1. Shared Core + App Slice

This slice should include:

- one `House`
- one `Human`
- two `Cats`
- one or two `Goals`
- two or three `Threads`
- a small `Inbox` with a few `Notices`
- one active `Session` with a mock transcript
- one visible `Whiteboard`
- one visible `Cabinet`
- one meaningful steering action

This is the slice that proves usefulness.

### 2. First Game Slice

This slice should reuse the same demo house and show:

- one readable room slice
- two visible cats with distinct states
- modular room construction rather than one baked background
- enough motion and feedback to feel alive
- one or two readable inspect flows

This is the slice that proves the world direction is real.

## First User Journey

The first user journey should be:

1. The user opens `/app/houses/:houseId`.
2. The user reviews notices, threads, cats, and one active session.
3. The user opens a thread and reads comments and activities.
4. The user adds a comment or memo.
5. The user sees a visible state change.
6. The user switches to `/game/houses/:houseId`.
7. The user sees the same house represented as a place with two readable cats.
8. The user inspects a cat and recognizes its work context.
9. The user opens the active session transcript or equivalent inspect view.
10. The user leaves feeling that app mode is useful and game mode is worth coming back for.

## MVP In-Scope Surfaces

### 1. Shared Core

The MVP should have one stable fixture-driven house state that both modes consume.

That should include:

- domain types
- fixtures
- selectors
- actions for reading and steering

### 2. App Mode

The MVP app mode should include:

- inbox view
- thread view
- cat inspection
- session view
- one steering action such as add comment or add memo

App mode is allowed to be conventional.
Its job is usefulness, not theater.

### 3. Game Mode

The MVP game mode should include:

- one room or room-like slice
- two cats in world space
- readable room cues
- a clear interaction target
- one or two inspect surfaces

Game mode does not need full product parity yet.
But it must already feel like the beginning of a real game surface.

### 4. Shared Mode Transition

The MVP should include a clear way to move between app mode and game mode for the same house.

The transition should make it obvious that:

- this is the same house
- this is the same cat state
- this is the same product

## Game Slice Quality Bar

The first game slice does not need to be huge.
But it does need to clear a quality bar.

It should not be:

- a single static background image
- static cat cutouts with no life
- a dashboard hidden under a canvas

It should already demonstrate:

- modular room construction
- readable depth and layering
- clear cat states
- motion or feedback that creates presence

## MVP Interaction Rules

The MVP interaction model should stay simple:

- inspect
- review
- steer
- switch modes

The MVP does not need:

- broad traversal
- deep simulation systems
- real multiplayer
- advanced customization
- full feature parity between modes

## MVP Out Of Scope

These are explicitly out of scope for the MVP:

- authentication
- real backend persistence
- real executor sessions
- cross-device sync
- advanced house policies
- deep economy or progression systems
- large-scale house building systems

## MVP Success Criteria

The MVP is successful if a small number of users can say:

- "I understood what the cats were doing."
- "The app mode already feels useful."
- "The game mode feels promising, not fake."
- "This feels like one product, not two unrelated surfaces."
- "I want to come back and see it improve."

## MVP Acceptance Checklist

The MVP should include:

- a shared fixture-driven house core
- an `/app/houses/:houseId` route with useful inspection and steering
- a `/game/houses/:houseId` route for the same house
- two visible cats
- one active session
- one inbox with notices
- one thread inspection flow
- one steering action
- one visible reaction to that action
- a game slice that is not just one baked background plus static sprites

## MVP Technical Strategy

The MVP should be built with:

- a renderer-agnostic domain model
- fixture-driven data
- a conventional app-mode client
- a real game runtime for game mode
- a shared action layer that both modes call into

## Next Step After MVP

If the MVP works, the next step is not "pick one mode and abandon the other."

The next step is:

- deepen the usefulness of app mode
- raise the polish bar in game mode
- increase continuity between the modes
- introduce real system state without forking the core model
