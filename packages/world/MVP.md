# OpenKitten World MVP

## Status

This document defines the MVP target for OpenKitten World.

The MVP should not be treated as one large stealth milestone.
It should be treated as a public capability ladder with small, visible steps.

The MVP assumes:

- one app on `world.openkitten.com`
- a shared core underneath both modes
- each capability is built `backend -> app -> game`
- app mode proves usefulness as early as possible
- game mode proves the world can become real as early as possible

## MVP Goal

The MVP should prove that OpenKitten World can become:

- a real async productivity system
- centered on Houses and Cats
- useful in app mode
- increasingly compelling in game mode
- easy to talk about and share in public while it is being built

The MVP is successful if a small number of early users can understand the work model, complete one meaningful async loop, and see why the House mode is worth continuing to build.

## Core Question

The MVP is mainly trying to answer this question:

`Can OpenKitten World become useful early through a shared core and app mode, while continuously earning intrigue and attachment through game mode along the way?`

## MVP Shape

The MVP is a ladder, not a cliff.

The preferred top-level capability order is:

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

Each capability should be delivered in this sequence:

1. backend
2. app mode
3. game mode

The purpose of this shape is:

- backend keeps the capability real
- app mode makes it useful
- game mode makes it embodied and distinctive

## Public Milestones

The MVP should explicitly separate `shareable` milestones from `tryable` milestones.

### Shareable Milestones

These are slices that are good for:

- social posts
- progress updates
- short clips
- screenshots
- focused public questions

The earliest strong shareable layer is usually:

- `Cats`

After that, especially strong shareable layers are:

- `Inbox + notices`
- `Sessions + transcripts`
- `Game-specific house identity`

### Tryable Milestones

These are slices that are good for:

- hands-on product testing
- meaningful feedback
- early user interviews
- invite-only alpha access

The first meaningful tryable milestone should start at:

- `Threads + comments`

The first strong invite-only alpha gate should start at:

- `Sessions + transcripts`

The first truly OpenKitten-shaped async control loop should appear at:

- `Direction + steering`

## Recommended Early Milestone Gates

### 1. First Socially Shareable Slice

The first socially shareable slice should land when:

- one `House` exists
- one or two `Cats` exist
- cat identity and state are visible
- game mode can show the same house without feeling like static decoration

This is enough to begin posting progress honestly.

### 2. First Friendly Tryable Slice

The first friendly tryable slice should land when:

- one house can be opened in app mode
- one thread can be read
- comments can be added
- users can understand what just happened

This is the first point where product feedback becomes more useful than concept feedback.

### 3. First Invite-Only Alpha

The first invite-only alpha should land when:

- inbox and notices exist
- executors and sessions are connected enough to inspect work
- transcripts make cat work legible
- users can understand what a cat is doing and why

This is the first point where OpenKitten World starts feeling like a real system rather than a promising shell.

### 4. First Distinctive OpenKitten Loop

The first truly distinctive loop should land when:

- goals, memos, or rules exist
- the human can steer the house intentionally
- app mode shows the result clearly
- game mode can echo that same state as part of the house

This is the point where OpenKitten becomes more than "agent dashboard plus world experiments."

## Capability-Level MVP Expectations

### Thin Substrate

This layer should stay intentionally thin.

It should include only the minimum needed to support the rest of the ladder:

- auth
- identity
- membership and permissions primitives
- IDs and timestamps
- blob or file storage primitives
- minimal event or job plumbing

This layer is not itself a public milestone.

### Houses

This is the first real product container.

It should enable:

- one or more houses
- membership in a house
- selecting and opening a house
- routing to the same house in both modes

### Cats

This is the first actor layer.

It should enable:

- cat identity
- cat state
- cat-to-house relation
- visible cat presence in both modes

### Threads + Comments

This is the first real work loop.

It should enable:

- a durable thread
- readable comments
- one meaningful write action
- understanding work in context

### Inbox + Notices

This is the first return loop.

It should enable:

- attention routing
- a reason to open the product again
- a reason to inspect a house, thread, cat, or session

### Executors

This is the runtime substrate for real cat work.

It should enable:

- executor identity or registry
- cat-to-executor linkage
- wake or dispatch primitives
- the path toward real session execution

### Sessions + Transcripts

This is the first strong observability layer.

It should enable:

- session inspection
- transcript reading
- understanding what a cat is doing now
- understanding why the system feels alive

### Direction + Steering

This is the first deep async control layer.

It should enable:

- goals
- memos
- rules
- a clear human steering loop

### Activities + History

This should be treated in two stages:

- internal event recording may exist earlier
- user-facing history should become prominent only once there is enough meaningful activity to show

### Artifacts + House Surfaces

This layer should include:

- product-level files
- cabinets
- whiteboards

The low-level storage primitive may exist much earlier.
The user-facing house surfaces belong here.

### Game-Specific House Identity

This is where the House becomes deeply ownable.

It should include:

- modular room construction
- props and layering
- layout persistence
- customization
- richer house identity in game mode

## MVP Interaction Rules

At every stage, the product should stay simple enough to explain quickly.

The MVP interaction model should prioritize:

- inspect
- review
- steer
- switch modes

The MVP does not need:

- broad traversal
- deep simulation systems
- real multiplayer
- deep economy systems
- full parity across every mode and every layer

## MVP Out Of Scope

These are explicitly out of scope for the MVP:

- broad multi-room traversal
- polished progression systems
- large-scale house customization
- cross-device sync
- real multiplayer
- deep economy systems

These can come later, after the shared async loop is already useful and the game presentation is already believable.

## MVP Success Criteria

The MVP is successful if a small number of early users can say:

- "I understood what the cats were doing."
- "I could do something useful in app mode."
- "The game mode feels promising, not fake."
- "This feels like one product, not two unrelated surfaces."
- "I want to come back and see the next layer."

## MVP Acceptance Checklist

The MVP should include:

- a visible public capability ladder
- a clear `backend -> app -> game` delivery model per capability
- at least one early shareable slice
- at least one early tryable slice
- a first invite-only alpha gate centered on sessions and transcripts
- a game slice that already feels alive enough to justify continued investment

## MVP Technical Strategy

The MVP should be built with:

- a renderer-agnostic domain model
- thin infrastructure, not endless infrastructure
- fixture-driven delivery where real backend behavior is not needed yet
- a conventional app-mode client
- a real game runtime for game mode
- a shared action layer that both modes call into

## Next Step After MVP

If the MVP works, the next step is not to replace app mode with game mode.

The next step is:

- keep climbing the same capability ladder
- deepen usefulness in app mode
- raise the quality bar in game mode
- increase continuity between the modes
- let more users try the product at each stronger milestone
