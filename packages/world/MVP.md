# OpenKitten World MVP

## Status

This document defines the MVP target for OpenKitten World.

The MVP assumes:

- a fullscreen Phaser House on `/`
- game-native inspection as the default interaction model
- mocked but believable work objects and cats

## MVP Goal

The MVP should prove that OpenKitten World can feel like:

- a real productivity system
- embodied as a living house
- presented as a fullscreen game-first experience
- without collapsing into either a generic dashboard or a generic toy

The MVP is successful if a user can enter a House, observe cats, inspect work, and feel:

- the House is a place
- the cats are alive
- the work model is understandable
- the game-native UI is readable
- the product becomes more compelling because it feels like a world

## Core Question

The MVP is mainly trying to answer this question:

`Can a fullscreen game-first House make serious async work feel alive, readable, and worth returning to?`

## MVP Product Promise

The MVP does not need to prove every part of the full product.

It only needs to prove these five things:

1. A `House` can feel spatial and alive.
2. A `Cat` can feel like a persistent individual, not a disposable run.
3. `Threads`, `Notices`, and `Sessions` can be understood through game-native inspection flows.
4. The interface can support real reading and steering without feeling like a dashboard.
5. The game presentation makes the product more emotionally convincing rather than less practical.

## MVP Slice

The first MVP should be a single playable House slice with mocked data.

It should include:

- one `House`
- one `Human`
- two `Cats`
- one or two `Goals`
- two or three `Threads`
- a small `Inbox` with a few `Notices`
- one active `Session` with a mock transcript
- one visible `Whiteboard`
- one visible `Cabinet`

The point is not feature breadth.
The point is to make the House feel believable as a working place.

## First User Journey

The first user journey should be:

1. The user opens `/` and enters a fullscreen House.
2. The user sees a small, readable, living room-like workspace with two visible cats.
3. One cat is clearly awake and one cat is clearly resting or asleep.
4. The user clicks a cat and opens a game-native inspect surface.
5. The user sees the cat's identity, current status, assigned threads, and active session.
6. The user opens the active session transcript and reads a mock live feed.
7. The user opens the inbox and reads a few notices.
8. The user opens a thread and reads comments and activities.
9. The user adds a comment or memo.
10. The House reacts in a visible way.

This should be enough to communicate the core OpenKitten fantasy.

## MVP In-Scope Surfaces

### 1. House View

The MVP needs one main House view that feels like a place.

It should show:

- a room or small house area
- two cats in world space
- a few recognizable objects and OpenKitten surfaces
- enough visual structure for the user to orient themselves quickly

The House does not need multiple rooms or traversal yet.
A single-screen slice is enough.

### 2. Cat Presence

The MVP should include at least two cats with clearly different states.

For example:

- one awake cat
- one resting or sleeping cat

Each cat should have:

- a name
- a clear visual identity
- a visible state
- a clickable interaction target

In the MVP, "awake" is enough to communicate that a cat is currently doing something.
The cat does not need workstation-specific animations.
State should read from the cat's own pose, face, or motion rather than from a required location in the room.

### 3. Cat Inspection Surface

Clicking a cat should open a surface that shows:

- identity
- role or flavor
- current status
- assigned threads
- active session, if any

This surface should preferably feel game-native.
DOM is acceptable only if it materially improves readability.

### 4. Inbox And Notices

The MVP should include a small inbox with a few notices representing common House attention items.

These notices should help the user understand:

- what needs attention
- what changed recently
- what the cats are doing

### 5. Thread View

The MVP should include at least one readable thread view with:

- comments
- activities
- assignment context
- open or closed state

The goal is not workflow depth.
The goal is proving that durable work objects fit naturally inside the House.

### 6. Session View

The MVP should include one active session with a mock transcript.

The transcript should communicate:

- what the cat is working on
- that the cat is actually doing something
- that sessions are inspectable, not magical black boxes

### 7. One Human Steering Action

The MVP should include one meaningful write action.

Recommended options:

- add a thread comment
- add a memo

This action should produce a visible reaction in the House or UI.

### 8. Visible House Cues

The MVP should include a few visible room cues that make work feel situated.

Recommended examples:

- a readable whiteboard zone
- a readable cabinet zone
- a readable notice or inbox zone
- a few baked-in household details that make the room feel warm and believable

Only OpenKitten-significant cues need to carry interaction in the MVP.
Most other environmental detail can stay presentational inside the room shell.

## MVP Interaction Rules

The MVP interaction model should be simple:

- click or tap visible objects
- open one inspection surface at a time
- keep transitions calm and readable
- allow the user to back out easily

The MVP does not need:

- free movement controls
- combat-like verbs
- broad traversal
- complicated inventory systems

## What The MVP Must Feel Like

The MVP should feel:

- fullscreen
- calm
- spatial
- readable
- game-native
- emotionally warm
- useful enough to inspect real work

The user should feel like they entered a House, not like they opened a dashboard tab.

## What The MVP Must Not Try To Do

The MVP should not try to prove:

- multi-room traversal
- deep simulation systems
- real multiplayer
- full executor integration
- a broad SaaS settings surface
- every possible work object

It should also avoid:

- surrounding browser chrome around the world
- giant panel stacks that dominate the route
- chat-first interaction as the main loop

## MVP Out Of Scope

These are explicitly out of scope for the MVP:

- authentication
- real backend persistence
- real executor sessions
- cross-device sync
- advanced house policies
- rich customization systems
- deep economy or progression systems

## MVP Success Criteria

The MVP is successful if a small number of users can say:

- "I understood what the cats were doing."
- "The House felt like a place."
- "Inspecting work felt natural."
- "This made me more interested in returning."
- "It felt more like a product than a toy."

## MVP Acceptance Checklist

The MVP should include:

- a runnable fullscreen `/` route
- one readable House slice
- two visible cats
- one active session
- one inbox with notices
- one thread inspection flow
- one steering action
- one visible reaction to that action

## MVP Technical Strategy

The MVP should be built with:

- Phaser as the primary runtime on `/`
- fixture-driven data
- game-native UI where practical
- optional DOM overlays only when clearly beneficial

The implementation should keep the domain model independent from the renderer so future evolution stays possible.

## Next Step After MVP

If the MVP works, the next step is not "add more screens."

The next step is:

- deepen the House feel
- strengthen cat presence
- tighten the steering loop
- integrate real system state without losing the game-first route shape
