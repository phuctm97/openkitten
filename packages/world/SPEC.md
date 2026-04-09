# OpenKitten World Spec

## Status

This document is the current canonical product and architecture spec for OpenKitten World.

The client model assumes:

- the product ontology stays House-and-Cats first
- the home route should be a fullscreen Phaser experience
- React remains available for routes and surfaces that are better served by conventional web UI

## Product Thesis

OpenKitten is a living `House` of `Cats` that pursue human-defined outcomes, coordinate through durable work objects, and use connected `Executors` to act in the real world.

The product should feel:

- serious enough to get real work done
- playful and ownable enough to feel like a world
- asynchronous-first
- observable
- not primarily chat-first

The human should mostly steer the House at a high level and let the cats do the work.

## Naming And Core Terms

The canonical singular nouns are:

- `House`
- `Human`
- `Cat`
- `Goal`
- `Thread`
- `Comment`
- `Activity`
- `Notice`
- `Inbox`
- `Memo`
- `Rule`
- `Whiteboard`
- `Cabinet`
- `File`
- `Executor`
- `Session`
- `Transcript`

These naming decisions are already settled:

- use `House` instead of `Company` or `Team`
- use `Thread` instead of `Issue`
- use `Executor` instead of `Runtime`
- use `Notice` for human-facing attention objects
- use `Transcript` for recorded session output

Plural labels are for collections and screens only.

## Core Product Principles

### 1. Cats Act, The House Holds

The House is the durable environment.
Cats and humans are the actors.

- the `House` holds shared state and history
- `Cats` and `Humans` do things inside it
- `Goals` and `Threads` are work objects
- `Whiteboards` and `Cabinets` are house surfaces
- `Files` are artifacts

### 2. Async-First, Not Chat-First

The human should mostly:

- set goals
- add memos
- add thread comments
- review notices
- inspect sessions
- steer or interrupt when necessary

OpenKitten should not collapse into "chat with cat avatars."

### 3. Serious Work Inside A Lovable Place

The world-like presentation is not decoration.
It is part of how the product communicates state, attachment, and legibility.

The product should not become:

- a generic SaaS dashboard
- a toy game with shallow work objects

### 4. Game-First Home Route

The main route should feel like entering a House.

That means:

- `/` should be fullscreen
- the primary runtime should be Phaser
- Phaser should own world presentation, selection, camera behavior, and visible reactions on `/`
- React DOM may render text-heavy work surfaces on `/` when it materially improves reading, writing, or accessibility
- those React surfaces should still feel subordinate to the world and native to the House

Other routes may still be normal React pages.

### 5. Stable Concepts, Replaceable Mechanisms

Several concepts are core to the product, but their implementations should stay swappable:

- cat memory
- rule application strategy
- wake packet construction
- transcript normalization
- executor integration details
- exact UI technology for non-game routes

The product promises the concepts, not one permanent implementation detail for each.

## World Model

The House is the persistent world shared by the human and the cats.

The clean mental model is:

- the `House` keeps shared facts and history
- each `Cat` keeps its own memory
- `Sessions` are temporary embodiments of cats inside executors

Another way to say it:

- the cat is the soul
- the executor is the body
- the session is one embodiment

## Core Domain Objects

### House

A `House` is the persistent home where cats, work, tools, and history live.

It exists to:

- hold the durable shared world
- give the product its visual and conceptual structure
- contain human-facing and cat-facing state

### Human

A `Human` is the person steering the House.

Their main role is to:

- set direction
- review state
- steer work
- intervene when needed

### Cat

A `Cat` is a persistent worker in the House.

Each cat should have:

- identity
- memory
- a default executor
- the ability to wake, act, and sleep

Cats are not disposable runs.

### Goal

A `Goal` is a durable outcome the House is trying to achieve.

Goals should guide:

- prioritization
- thread creation
- review and steering

### Thread

A `Thread` is the main durable work object.

Threads hold:

- discussion
- work history
- assignment context
- related files or references

The core thread lifecycle is intentionally simple:

- `Open`
- `Closed`

### Comment

A `Comment` is an authored message on a thread.

Comments are the primary async communication surface for work.

### Activity

An `Activity` is a durable recorded event in the House.

Activities capture system or workflow facts that should persist in history.

### Notice

A `Notice` is a human-facing attention object.

Notices should feel calm and reviewable, not loud and alarm-like.

### Inbox

An `Inbox` is the collection of notices currently waiting for human review.

### Memo

A `Memo` is a durable piece of human steering for cats or the House.

Memos are a core way to nudge behavior without micromanaging every turn.

### Rule

A `Rule` is a standing constraint or preference that shapes House behavior.

Rules are durable guidance, not one-off instructions.

### Whiteboard

A `Whiteboard` is a shared thinking surface inside the House.

It represents active planning and rough working state.

### Cabinet

A `Cabinet` is a durable storage surface for files and artifacts.

### File

A `File` is a durable artifact the House can reference or store.

### Executor

An `Executor` is the external runtime that can embody a cat and execute a session.

OpenKitten owns the House.
Executors run cat turns.

### Session

A `Session` is one active embodiment of a cat on an executor.

A session should expose:

- which cat is running
- what it is working on
- current status
- transcript output

### Transcript

A `Transcript` is the readable record of session output.

It should help the human inspect work without reading raw runtime internals.

## Work Model

The preferred work model is:

- goals guide work
- threads carry durable work
- comments carry authored communication
- activities capture durable events
- notices route attention to the human

The system should avoid overcomplicated lifecycle taxonomies early on.

## Assignment And Concurrency

The preferred early model is:

- a thread may be associated with one active cat at a time
- a cat may work on a limited number of active threads
- active sessions may temporarily claim a thread while working

This keeps concurrency understandable without introducing a heavy workflow state machine.

Open questions about stricter policies should remain implementation details until real use demands them.

## Human / Cat Interaction Model

### Primary Human Actions

The human should mostly:

- define goals
- review inbox notices
- inspect cats
- inspect sessions
- add thread comments
- add memos
- adjust rules
- interrupt or redirect when necessary

### Steering Versus Chat

Steering should be the default.

That means the main loop is:

- observe
- inspect
- nudge
- review results

Direct chat with cats may exist later, but it should not replace the core async work model.

### Session Inspection

Sessions should be inspectable enough that the human can answer:

- what is this cat doing?
- why is it doing that?
- what changed?
- does intervention seem necessary?

## Wake Model

Cats should wake because of meaningful reasons such as:

- a new notice-worthy event
- a newly relevant goal or thread
- explicit human steering
- scheduled or policy-driven work

Cats should receive a bounded wake context, not the entire world state every time.

That wake packet can evolve over time, but the core product promise is:

- cats wake with enough context to act intelligently

## Executors And Sessions

OpenKitten owns:

- cat identity
- house state
- goals, threads, comments, activities, notices, memos, and rules
- wake logic
- session inspection surfaces

Executors own:

- how a session actually runs
- executor-side tools
- executor-side environment details

This is a deliberate control-plane split:

- OpenKitten owns the House
- executors run cat turns

## House Tools Versus Executor Tools

The product should preserve a distinction between:

- House tools, which operate on House-owned concepts
- Executor tools, which operate in the executor runtime or external world

Examples of House tools:

- read thread
- add comment
- read notices
- inspect goals
- access whiteboard or cabinet state

Examples of executor tools:

- external integrations
- runtime-specific capabilities
- environment-specific execution actions

## Client Model

The preferred client model is:

- `/` is the fullscreen House experience
- Phaser is the primary runtime for `/`
- Phaser owns the world-first interaction grammar on `/`
- React may render non-game routes separately
- React DOM may render dense work surfaces on `/` when it clearly improves clarity and input

This implies:

- no permanent dashboard shell around the world
- no assumption that every inspect surface should be a DOM card
- no default assumption that large work surfaces need to chase moving world objects
- a route architecture that allows game and non-game routes to coexist cleanly

## Implementation Boundaries

The implementation should preserve these boundaries:

- the domain model stays renderer-agnostic
- Phaser owns the home-route frame loop and real-time interaction
- Phaser owns world positioning, camera behavior, selection, and visible effects
- React may own dense reading and writing surfaces on `/`
- React Router owns routing
- Jotai may be used as a narrow shared store between Phaser and React
- executor integration stays separate from the world client

The implementation should avoid:

- React driving the game loop
- a chatty cross-runtime state model
- world rendering trapped inside a permanent app shell

## Near-Term Product Invariants

The first convincing slice should preserve these invariants:

- one House is enough
- two cats are enough
- one active session is enough
- one readable steering action is enough
- mocked data is acceptable
- the route must already feel like a place

If the product does not feel like a place, adding more objects will not fix the core problem.

## Future Concepts Worth Preserving

These concepts are worth preserving for future expansion even if they are not deeply implemented yet:

- dream or reflection turns
- richer house policies
- shared houses
- deeper traversal across multiple rooms
- stronger file and artifact systems
- more explicit collaboration between cats

They should remain downstream of the core House-and-Cats model, not replacements for it.

## One-Sentence Summary

OpenKitten World is a persistent House of Cats doing real work, presented primarily as a fullscreen game-like browser world while preserving a stable product model underneath.
