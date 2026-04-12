# OpenKitten World Spec

## Status

This document is the canonical product and architecture spec for OpenKitten World.

The product model assumes:

- the ontology stays House-and-Cats first
- OpenKitten World is one app on `world.openkitten.com`
- the app has separate `app` and `game` route trees
- both modes share one core domain model, backend, and action layer
- game mode may add world-specific presentation state without forking the core

## Product Thesis

OpenKitten World is a system of `Houses` full of `Cats` that pursue human-defined outcomes, coordinate through durable work objects, and use connected `Executors` to act in the real world.

The product should feel:

- serious enough to get real work done
- ownable enough to feel like a world
- asynchronous-first
- observable
- not primarily chat-first

The human should mostly steer the Houses at a high level and let the cats do the work.

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

`Mode` is not a domain object.
It is a presentation choice over the same shared core.

## Core Product Principles

### 1. Cats Act, The House Holds

The `House` is the durable environment.
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

### 3. One Product, Two Modes

OpenKitten World should present the same core system through:

- `app` mode for clarity and efficiency
- `game` mode for presence, attachment, and world feel

These modes should share:

- auth and identity
- houses and cats
- work objects and history
- actions and permissions
- backend and persistence

They should not duplicate the core business model.

### 4. Useful First, World Second

The shared core must become useful before game mode is expected to carry the product.

That means early implementation should first prove:

- the work model is valuable
- the steering loop is understandable
- cats and sessions are inspectable
- the system is worth returning to

Game mode should deepen that value, not compensate for its absence.

### 5. Serious Work Inside A Lovable Place

The world-like presentation is not decoration.
It is part of how the product communicates state, attachment, and legibility.

The product should not become:

- a generic SaaS dashboard
- a toy game with shallow work objects
- a static art scene pretending to be a game

### 6. Stable Concepts, Replaceable Mechanisms

Several concepts are core to the product, but their implementations should stay swappable:

- cat memory
- rule application strategy
- wake packet construction
- transcript normalization
- executor integration details
- exact UI technology for app mode
- exact game runtime technology for game mode

The product promises the concepts, not one permanent implementation detail for each.

## Shared Domain Model

The clean mental model is:

- a `House` keeps shared facts and history
- each `Cat` keeps its own memory
- `Sessions` are temporary embodiments of cats inside executors

Another way to say it:

- the cat is the soul
- the executor is the body
- the session is one embodiment

The core domain objects mean:

- `House`: a durable home where cats, work, tools, and history live
- `Human`: the person steering one or more houses
- `Cat`: a persistent worker with identity, memory, and a default executor
- `Goal`: a durable outcome the house is trying to achieve
- `Thread`: the main durable work object, with a simple early lifecycle of `Open` or `Closed`
- `Comment`: an authored message on a thread
- `Activity`: a durable recorded event in the house
- `Notice`: a calm, human-facing attention object
- `Inbox`: the collection of notices waiting for review
- `Memo`: durable steering from the human to cats or the house
- `Rule`: a standing constraint or preference
- `Whiteboard`: a shared thinking surface
- `Cabinet`: durable storage for files and artifacts
- `File`: a durable artifact the house can reference or store
- `Executor`: the external runtime that can embody a cat and execute a session
- `Session`: one active embodiment of a cat on an executor, including current work and status
- `Transcript`: the readable record of session output

The domain model must support multiple `Houses`.
Each house is its own durable world with its own cats, work, appearance, and history.

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

- OpenKitten owns the Houses
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

## Mode Model

The route model should distinguish cleanly between the two modes:

- `/app/...`
- `/game/...`

Examples:

- `/app/houses/:houseId`
- `/game/houses/:houseId`

`App` mode should optimize for:

- fast review
- dense information handling
- efficient editing and steering
- accessibility and conventional web interaction

`Game` mode should optimize for:

- presence
- spatial understanding
- animation and atmosphere
- emotional attachment
- customization and house identity

The same house should remain continuous across both modes.

## Shared Core Versus Mode-Specific State

The shared core should include:

- domain types
- persisted house state
- actions and permissions
- backend integration
- selectors and view models that can serve both modes

Mode-specific state may include:

- route-local UI state in app mode
- camera, movement, hover, and animation state in game mode
- room composition, prop placement, and other presentation-specific state
- game-only interaction state that does not change shared product meaning

Mode-specific state must not become a second source of truth for core work objects.

## Client Model

The preferred client model is:

- one browser product on `world.openkitten.com`
- separate `app` and `game` route trees
- a shared auth, data, and action layer underneath
- lazy loading and runtime isolation where appropriate

This implies:

- no need to maintain two separate products for the same system
- no requirement that app mode and game mode share the same shell layout
- no assumption that game mode should inherit app-mode UI chrome

## Implementation Boundaries

The implementation should preserve these boundaries:

- the domain model stays renderer-agnostic
- app mode and game mode share the same business actions
- game mode presentation stays separate from app mode presentation
- executor integration stays separate from world-client rendering details

The implementation should avoid:

- duplicated business logic across modes
- game mode becoming a static visualization with no product meaning
- app mode assumptions leaking into the game runtime
- game runtime assumptions polluting the core domain model

## Near-Term Product Invariants

The first convincing slices should preserve these invariants:

- one house is enough to start
- two cats are enough to start
- one active session is enough to start
- one readable steering action is enough to start
- mocked data is acceptable
- app mode must already be useful
- game mode must already feel alive enough to justify itself

If the core is not useful, adding a world will not fix that.
If the world does not feel alive, adding more static art will not fix that either.

## Future Concepts Worth Preserving

These concepts are worth preserving for future expansion even if they are not deeply implemented yet:

- dream or reflection turns
- richer house policies
- shared houses
- deeper traversal across multiple rooms
- stronger file and artifact systems
- more explicit collaboration between cats
- richer house customization and ownership

They should remain downstream of the core House-and-Cats model, not replacements for it.

## One-Sentence Summary

OpenKitten World is one product with `app` and `game` modes over a shared House-and-Cats core, proving utility first and then deepening it through a polished world experience.
