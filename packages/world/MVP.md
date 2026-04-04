# OpenKitten World MVP

## Status

This document defines the current MVP target for OpenKitten World.

It is not the full product roadmap.
It is the smallest vertical slice that should prove the product direction, the world presentation, and the usefulness of the House-and-Cats model.

This document should help product and engineering answer:

- what the first build must actually do
- what the MVP is trying to prove
- what is intentionally out of scope
- what success looks like before deeper world-building or executor integration

## MVP Goal

The MVP should prove that OpenKitten World can feel like:

- a real productivity system
- embodied as a living house
- with cats that feel present
- without collapsing into a generic SaaS dashboard or a generic game prototype

The MVP is successful if a user can enter a House, observe cats, inspect real work surfaces, and feel:

- the House is a place
- the cats are alive
- the work model is understandable
- the interface is readable and comfortable
- the product is more emotionally compelling than a standard dashboard

## Core Question

The MVP is mainly trying to answer this question:

`Can OpenKitten World make serious async work feel alive, lovable, and legible through a world-like interface without making the work harder?`

## MVP Product Promise

The MVP does not need to prove every part of the full spec.

It only needs to prove these five things:

1. A `House` can feel spatial and alive.
2. A `Cat` can feel like a persistent individual, not a disposable run.
3. `Threads`, `Notices`, and `Sessions` can be understood through the world and nearby panels.
4. The product can support real reading, writing, and inspection without visual fatigue.
5. The world presentation makes the product more compelling rather than more confusing.

## MVP Slice

The first MVP should be a single playable house slice with mocked data.

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

The point is not to support every object deeply.
The point is to make the House feel like a believable living workspace.

## First User Journey

The first user journey should be:

1. The user opens OpenKitten World and enters a House.
2. The user sees a small, readable, living room-like workspace with two visible cats.
3. One cat is clearly active and working.
4. The user clicks that cat and opens its detail panel.
5. The user sees the cat's identity, current status, assigned threads, and current active session.
6. The user opens the active session transcript and watches a mock stream update.
7. The user opens the inbox and reads a few notices.
8. The user opens a thread and reads comments and activities.
9. The user adds a comment or memo.
10. The House reacts in some visible way.

This should be enough to communicate the core OpenKitten fantasy.

## MVP In-Scope Surfaces

### 1. House View

The MVP needs a single main House view that feels like a place.

It should show:

- a room or small house area
- two cats in world space
- a few recognizable objects or stations
- enough visual structure for the user to orient themselves quickly

The House does not need multiple rooms or map traversal yet.
A single-screen house slice is enough for the MVP.

### 2. Cat Presence

The MVP should include at least two cats with clearly different states.

For example:

- one active cat working at a station
- one idle or resting cat

Each cat should have:

- a name
- a simple visual identity
- a visible state
- a clickable interaction target

The cats do not need deep autonomy yet.
They only need to feel present and individually recognizable.

### 3. Cat Detail Panel

Clicking a cat should open a panel that shows:

- identity
- role or flavor
- current status
- assigned threads
- active session, if any

This panel is important because it proves that cats are inspectable workers, not just decorative mascots.

### 4. Inbox And Notices

The MVP should include a small inbox.

The inbox should contain a few notices that represent common House attention items, such as:

- a cat mentioned the human on a thread
- a cat requested review
- a thread changed recently

The user should be able to open the inbox, read notices, and use them to navigate into the related work.

### 5. Thread View

The MVP needs at least one readable thread panel.

It should show:

- title
- assignee
- status
- comments
- activities
- linked session history or active session reference

The user should be able to add a comment in the MVP.

### 6. Session View

The MVP needs one active session view with a mock transcript.

It should prove:

- that sessions are inspectable
- that a cat can feel active right now
- that the user can watch work happening in a legible way

The transcript can be mocked.
The important part is the interaction model and presentation.

### 7. One Human Steering Action

The MVP should include at least one human write action.

The best candidates are:

- add a thread comment
- add a memo

The MVP does not need both if one is much simpler to build first.
But at least one should exist so the user can feel they are participating in the House.

### 8. Visible House Props

The MVP should show at least:

- one `Whiteboard`
- one `Cabinet`

These do not need to be fully functional in the first slice.
But they should exist visually so the House feels like a real place with more than cats and panels.

## Recommended MVP Scenario

The recommended fixed demo scenario is:

- `Mochi` is actively working on a thread and has an open session.
- `Pepper` is present in the house but not actively working right now.
- there is a recent notice asking the human to review something or read a mention.
- one thread is clearly current and connected to Mochi's session.
- the user can comment on that thread.
- the House responds visibly when the user does.

This is a very strong demo because it shows:

- one working cat
- one non-working cat
- one current work thread
- one inbox item
- one active session
- one human steering action

without requiring a large data model or many features.

## MVP Interaction Rules

The MVP should preserve the product model even with mocked data.

That means:

- the human is mostly observing, reviewing, and nudging
- cats are the visible workers
- communication is async-first
- the product is not chat-first

So the MVP should not default to:

- a giant chat box
- direct DM-style cat interaction
- raw executor debugging UI

## What The MVP Must Feel Like

The MVP should feel:

- calm
- warm
- readable
- functional
- spatial
- slightly magical
- already useful

It should not feel:

- like a tech demo of sprites moving around
- like a Figma prototype with cats pasted on top
- like a generic game scene without clear utility
- like a text product that just happens to have a background image

## What The MVP Must Not Try To Do

The MVP should not try to prove:

- full executor integration
- full wake logic
- real cat memory
- memo turns
- dream turns
- multi-house support
- multi-human collaboration
- real authentication
- real persistence
- mobile-perfect responsiveness
- complete world navigation
- complete whiteboard or cabinet behavior
- real notices pipeline
- full art polish

Those things are important later, but they are not required to validate the core product shape.

## MVP Out Of Scope

The following should be explicitly out of scope for the first MVP slice:

- real external executors
- real backend sync
- real cat autonomy
- rules enforcement
- memo incorporation
- notice generation logic
- file uploads
- real cabinet inventory management
- whiteboard editing
- dream turns
- watch or collaborator systems
- multi-room traversal
- deep accessibility and full keyboard coverage
- account management
- onboarding flow

## MVP Success Criteria

The MVP is successful if the team can honestly say:

- the House already feels like a place
- the cats already feel like individuals
- the user can understand what is happening without a tutorial-heavy explanation
- reading and writing inside the product already feels comfortable
- the product already feels different from a generic AI dashboard
- the team can clearly imagine building the full product from this foundation

## MVP Acceptance Checklist

- one House scene exists
- two visible cats exist
- at least one cat has an active session
- a cat detail panel exists
- an inbox exists
- a thread panel exists
- at least one human write action exists
- a mock transcript stream exists
- the world visibly reacts to user interaction
- the visual presentation already aligns with the current visual direction
- the product still feels like work software, not just a toy

## MVP Technical Strategy

The MVP should use:

- mocked House state
- mocked session transcript updates
- no real executor dependency
- no real backend dependency

The goal is to validate:

- interaction model
- spatial model
- UI comfort
- world legibility
- basic emotional feel

before connecting the full runtime and backend systems.

## Next Step After MVP

If the MVP works, the next step should be:

- connect the mocked world to a real application state model
- deepen House surfaces one by one
- add real data flow and eventually real executors
- increase world richness only where it clearly improves the product

The MVP should create confidence in the product shape, not try to complete the product.
