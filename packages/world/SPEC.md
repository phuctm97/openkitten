# OpenKitten World Spec

## Status

This document is the current canonical product and architecture spec for OpenKitten World.

It is written for two audiences at once:

- product and software people who need the full model and terminology without reading prior brainstorming
- experienced engineers who need enough clarity to start implementation planning without reopening settled product decisions

This spec intentionally separates:

- **core ontology**
  What OpenKitten fundamentally is
- **operational behavior**
  How the house, cats, turns, and executors behave
- **implementation strategy**
  Details that should remain replaceable over time

OpenKitten should preserve the first two and keep the third flexible.

Even though this document includes a detailed core model, it is intentionally broader than ontology alone. It is the package's main specification document.

## Product Thesis

OpenKitten is a living **House** of **Cats** that pursue human-defined outcomes, coordinate through durable work objects, and use connected **Executors** to act in the real world.

This package describes **OpenKitten World**, which is the long-lived House-and-Cats product model.
It is intentionally separate from the current Telegram-focused bot package.

The product should feel:

- serious enough to get real work done
- playful and ownable enough to feel like a world, not just a dashboard
- asynchronous-first
- highly observable
- not primarily a chatbot

The human should mostly steer the House at a high level and let the cats do the work.

## Naming Principles

### Core Naming Style

The core ontology uses singular nouns:

- `House`
- `Cat`
- `Human`
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

Plural labels are for collections and screens only:

- `Cats`
- `Goals`
- `Threads`
- `Rules`
- `Whiteboards`
- `Cabinets`
- `Files`

### Chosen Terms

These naming decisions are already settled:

- Use **House** instead of `Company` or `Team`.
  House is the product-defining concept because it conveys growth, attachment, worldbuilding, and the long-lived nature of the cats.
- Use **Thread** instead of `Issue`.
  Thread is more OpenKitten-native, visually richer, and still strong enough to carry a work lifecycle.
- Use **Executor** instead of `Runtime`.
  Executor is clearer in product/UI/docs, less overloaded, and better communicates "the thing that runs a cat turn."
- Use **Comment** for authored messages on a thread.
- Use **Activity** for durable recorded events in the House.
- Use **Notice** for human-facing attention objects.
  Notice is calmer, more async, and better fits the product tone than louder or more UI-plumbing-style alternatives.
- Use **Transcript** instead of `Stream` for recorded session output.
- Use **mentions** instead of `references` for links to objects inside comments and memos.

### Explicit Non-Choices

These ideas were explored and intentionally not chosen for the current core model:

- `Company` as the main container
- `Team` as the main container
- `Issue` as the main work object
- louder alert-centric naming for the human attention object
- `Runtime` as the main session environment concept
- `Notebooks` and `Bookshelves` for v1 durable storage
- chat-first interaction as the main human/cat interaction model

## Core Product Principles

### 1. Cats act, the House holds

The House is the durable environment. Cats and humans are the actors.

- The **House** holds state, history, and shared work surfaces.
- **Cats** and **Humans** do things inside the House.
- **Goals** and **Threads** are work objects.
- **Whiteboards** and **Cabinets** are spaces/tools.
- **Files** are artifacts.

### 2. Async-first, not chat-first

The human should mostly:

- create or update goals
- add memos
- add thread comments
- review notices in the inbox
- observe the house and cats
- interrupt or steer active sessions when necessary

The product should not collapse into "chat with cat avatars."

Direct cat chat is a future possibility, not a core v1 interaction.

### 3. OpenKitten owns the House, not the executor internals

OpenKitten owns:

- the house model
- cat identity
- goals, threads, comments, activities, notices, memos, rules
- whiteboards, cabinets, files
- wakeups, sessions, cat memory concepts, and turn orchestration

Executors own:

- how one cat session runs
- executor-side tools and capabilities
- executor-side environment details

This is a deliberate control-plane split:

- OpenKitten owns the House and home data
- connected executors run cat turns

OpenKitten should integrate multiple executors rather than trying to rebuild every executor category itself.

The user should primarily bond with the cat, not the underlying executor.

### 4. Keep the ontology small and strong

Prefer a small number of powerful concepts over a large taxonomy of workflow states.

Examples:

- `Thread` uses `Open | Closed`, not a long kanban lifecycle
- review requests are comments/activities/notices, not a special thread status
- close reasons are comments today, not a special close object

### 5. Stable concepts, replaceable mechanisms

Several concepts are core to the product, but their implementations should stay swappable:

- cat memory
- rule application strategy
- wake packet construction details
- transcript normalization depth
- executor integration details

The product promises that cats remember, that rules shape behavior, and that sessions can run on executors. It should not prematurely promise one fixed technical strategy for any of those.

### 6. Flexible by default, stricter by policy later

OpenKitten should be strong at helping people get things done while staying fun and not overly opinionated about how a House must be run.

The general preference is:

- keep the core model flexible
- let cats stay proactive and intelligent
- let humans run their house in different styles
- add stricter coordination rules later as optional house policies only when they clearly improve results

## World Model

The House is the persistent world shared by the human and the cats.

The clean mental model is:

- **House** keeps the shared facts and history.
- **Each Cat** keeps its own memory.
- **Sessions** are temporary embodiments of cats inside executors.

Another way to say it:

- the cat is the soul
- the executor is the body
- the session is one embodiment of that cat in that body

## Core Domain Objects

### House

**Definition**

A `House` is the persistent home/base where cats, work, tools, and history live.

**What it is for**

- hold the durable shared world
- give the product its visual and conceptual structure
- contain the human-facing and cat-facing state

**What it is not**

- not a single session
- not just a dashboard
- not one shared mind or memory

### Human

**Definition**

A `Human` is the owner/operator of the House.

**Role**

Humans mostly set direction, review what matters, and nudge the House asynchronously.

Humans are expected to:

- create and close goals
- write memos
- create and archive rules
- read and respond to notices
- add comments to threads
- observe cats, sessions, whiteboards, cabinets, and files
- interrupt or steer active sessions when necessary

### Cat

**Definition**

A `Cat` is a persistent worker in the House with identity, role, memory, and a default executor.

**Key properties**

- persistent identity
- own memory
- wakeup policy
- default executor
- responsibilities and current work
- a durable cursor/bookmark for what relevant house activity it has already processed

Each new session should rehydrate the cat from shared house state, cat memory, and the wake packet instead of depending on hidden long-lived runtime state.

**Important constraints**

- a cat is not a permanently running daemon
- a cat is not identical to one executor session
- a cat may have multiple threads assigned
- a cat usually has at most one active session at a time

### Goal

**Definition**

A `Goal` is an outcome the House wants to achieve.

**Role**

Goals are high-level, mostly human-owned, and strategic.

Goals tell the cats what outcomes matter. They are not the place where detailed work happens.

**Fields**

- `title` required
- `description` optional
- `status`: `Open | Closed`

**Ownership**

- humans create/update/close goals
- cats can read/query goals
- cats do not edit goals directly

**Important notes**

- a goal is not a task
- a goal is not necessarily a strict parent of all related threads
- goals do not directly own files or activities in the core model
- threads may reference zero, one, or many goals

**Product guidance**

The default goal input should feel lightweight:

- one main input box is enough for creation
- title is primary
- description is optional supporting context

### Thread

**Definition**

A `Thread` is a durable work item in the House.

It is the main object where concrete work becomes legible.

**Role**

Threads are where:

- cats take responsibility
- comments accumulate
- activities attach
- sessions can be associated
- humans and cats collaborate asynchronously

Thread timelines should be able to show:

- comments
- activities
- related sessions

**Fields**

- title
- `status`: `Open | Closed`
- `assignee?: Cat`

Other relationships are references rather than strict ownership:

- threads may reference goals
- threads may reference other threads
- threads may mention files

**Important design decisions**

- a thread is not an "ongoing discussion" object
- the discussion inside a thread is carried by comments
- thread status is intentionally minimal
- `Blocked`, `Needs Review`, `Done`, and `In Progress` are not core thread statuses

**Why only `Open | Closed`**

The status should answer one simple question:

- is this thread still active in the House, or not?

Conditions like waiting, review, or active work should be represented through comments, activities, notices, and session claims, not through more core statuses.

**Assignment**

Each thread has zero or one assignee.

`Thread.assignee?: Cat`

This is a core-model constraint, not just a policy.

**Why single assignee**

Single assignee keeps:

- responsibility clear
- wake and routing logic simple
- accountability obvious to humans
- duplication of effort lower

Multi-assignee use cases should be handled through:

- comments
- future watchers/collaborators
- related threads
- reassignment

### Comment

**Definition**

A `Comment` is an authored message on a `Thread`.

**Fields**

- author
- timestamp
- thread
- content
- optional mentions

Mentions are the general linking mechanism inside comments.
They may point to cats, humans, threads, files, goals, and other house objects.

**Role**

Comments are the main async communication surface on a thread.

Comments can carry:

- progress updates
- questions
- review requests
- explanations
- close reasons
- handoffs
- reasoning
- mentions of cats, humans, files, threads, goals, and other objects

**Important constraints**

- a comment belongs to exactly one thread in v1
- comments are not general cross-object notes in the core model

**Future extensibility**

For now, close reasons, review requests, handoffs, and similar actions are plain comments.

Later, OpenKitten may add structured comment-like types such as:

- request review
- close thread
- handoff
- reassign

Those structured types should still generate activities.

### Activity

**Definition**

An `Activity` is a durable record that something meaningful happened in the House.

**Fields**

- timestamp
- actor
- type
- subject
- payload

**Actor**

An activity can be caused by:

- a human
- a cat
- the system

**Subject**

Activities may be about:

- goal
- thread
- comment
- memo
- rule
- notice
- whiteboard
- cabinet
- file
- session

**Important constraints**

- activity is not raw executor output
- not every tiny event should become an activity
- only meaningful state changes or notable events should become activities

**Examples**

- goal created
- thread assigned
- comment added
- thread claimed by a session
- thread closed
- memo created
- rule archived
- file uploaded
- whiteboard updated
- session started
- session completed

**Relationship to comments**

Every comment creation also creates an activity.

This gives OpenKitten a uniform way to:

- build wake packets
- power timelines
- build history
- decide what cats should catch up on

### Notice

**Definition**

A `Notice` is a human-facing attention item created by the House.

**Role**

The inbox is not the whole history of the House. It is the subset of things that deserve the human's attention.

Notices exist to route attention calmly and asynchronously.

Notices should be first-class objects, not just a filtered activity view, because the inbox needs its own attention-management behavior.

The exact notice lifecycle is not locked yet, but the model should leave room for inbox-native states such as read, resolved, or snoozed.

Most notices should be system-created attention objects derived from comments, activities, requests, watches if present, and other house events.
They should not be modeled as if they were always directly authored messages from cats.

**Typical triggers**

- the human was mentioned in a comment
- a cat requested review
- a cat asked a question
- a watched thread changed, if watch support exists
- an important thread changed in a way the House decides is worth surfacing
- a notable completion happened
- a notable failure happened

**Important design decision**

Use `Notice`.

The chosen term should feel calm, asynchronous, and worth coming back to, not loud or interruptive.

**Object design**

A notice should usually point to the underlying thing, not replace it.

Examples:

- a comment exists on a thread
- that comment creates an activity
- the system creates a notice pointing to that comment or activity because the human should look at it

This keeps attention-routing separate from the actual work object.

If OpenKitten later adds direct cat-to-human message objects, notices should still point to those objects rather than absorbing them.

### Inbox

**Definition**

The `Inbox` is the human-facing place where notices live.

**Role**

The inbox is the human's calm attention surface, not the whole event stream of the house.

### Memo

**Definition**

A `Memo` is a lightweight direction from the human to the House.

**Role**

Goals define outcomes. Memos add ongoing context, nuance, preferences, or course corrections.

Memos are intentionally lightweight. They should feel like the human dropping a note into the House without having to over-structure it.

**Fields**

- author
- created at
- content
- target
- `status`: `Active | Archived`

**Targeting**

Memos target:

- `All Cats` by default
- optionally, a selected subset of cats

Memos do not belong to a goal or thread.

If they need to point to other objects, they do so through mentions.

**Important design decisions**

- a memo is standalone, not attached to a thread
- a memo is not a rule
- a memo is not a chat message
- a memo should be easy to write quickly
- memos are free text and may contain mentions just like comments

**Lifecycle**

The preferred memo lifecycle is:

1. the human creates one or more memos
2. memo creation is debounced and grouped into a memo batch/brief
3. targeted cats receive dedicated memo turns
4. each cat incorporates the memos into its own memory
5. once all targeted cats complete their memo turns, those memos are archived

There is no need for a generic hard expiry if memo turns exist.

The key idea is:

- memos are stored in the House
- cats must process them in dedicated memo turns to incorporate them
- the House should not assume that storage alone equals memory uptake

**Optional behavior**

Whether newly active memos also appear in normal wake packets before memo turns happen is a policy/implementation choice.

That choice controls how early memos begin steering the house before formal incorporation.

### Rule

**Definition**

A `Rule` is a standing constraint the House should follow.

**Role**

Rules are stricter than memos.

They say what the cats should do or should not do.

**Fields**

- author
- created at
- content
- `status`: `Active | Archived`

**Important design decisions**

- rules are free text
- `DO / DON'T` phrasing is a recommended writing convention, not schema
- rules are human-owned
- cats do not edit rules directly
- rules are house-wide in v1
- rules should stay easy for humans to write in natural language

**What a rule is not**

- not a technical policy engine
- not a turn-specific setting object
- not a structured permission matrix

**Implementation note**

Rules will likely be injected into cat turns in some form, but the exact application mechanism should remain replaceable.

Do not bake "rules are system prompts" into the core ontology.

### Whiteboard

**Definition**

A `Whiteboard` is a shared ephemeral thinking surface in the House.

**Role**

Whiteboards are where cats bounce ideas around, sketch, plan, and leave temporary working state.

**Important characteristics**

- shared
- visible
- ephemeral
- useful for messy and exploratory work

The exact number of whiteboards in a house is a UX choice, not a core ontology rule.

### Cabinet

**Definition**

A `Cabinet` is a storage place in the House for files.

**Role**

Cabinets organize files.

Multiple cabinets are allowed.

**Important design decision**

Cabinets are spaces/tools, not actors.

Threads and goals do not "pull files in and out." Cats and humans do.

Cabinets should stay simple storage places in v1, not smart workflow objects.

### File

**Definition**

A `File` is an artifact that cats and humans can read, write, upload, download, and reference.

**Role**

Files are intentionally plain files.

They should not be over-themed.

**Important constraints**

- files live in cabinets
- files do not belong to threads
- threads can mention files in comments

Later, OpenKitten may add explicit thread-file links to improve UI/search, but the core storage model should remain:

- files live in cabinets
- threads reference files

## Human Steering Stack

OpenKitten has three main human steering primitives:

- `Goal`
  outcome
- `Memo`
  lightweight guidance
- `Rule`
  standing constraint

This is the main high-level control model.

The human should not need to micromanage cats through constant direct conversation.

## Human/Cat Interaction Model

### Core principle

Humans mostly observe, review, and nudge.

Cats mostly act, coordinate, and surface what matters.

### Primary human actions

- create or update goals
- write memos
- create/archive rules
- review notices in the inbox
- add comments to threads
- inspect whiteboards, cabinets, files, threads, sessions, and cat details
- interrupt an active session
- steer an active session

### Cat chat

Direct freeform chat with cats is not a core v1 interaction.

This is a product hypothesis and current non-priority, not a permanent law.

OpenKitten should remain able to add cat chat later if users want it.

### Session inspection

When the human clicks a cat, they should be able to see:

- current status
- active session, if any
- current transcript, if available
- recent session history
- associated work context

### Steering

Steering an active session is allowed, but it is session-scoped.

It does not have to become durable shared house state automatically.

The cat decides what durable updates to write back to the House.

## Work Model

### Goals guide work; threads carry work

This is one of the most important product distinctions.

- goals tell the house what outcomes matter
- threads carry the concrete work

Goals stay high-level.
Threads are where work becomes inspectable and collaborative.

### Thread comments vs activities

Inside a thread:

- `Comment` is intentional communication
- `Activity` is durable recorded history of meaningful events

They may appear together in the UI timeline, but they are not the same concept.

### Review and close behavior

OpenKitten intentionally does **not** model review as a thread status or reviewer field in the core model.

Current model:

- if someone wants review, they write a comment
- that creates an activity
- the system may create a notice for the human
- the thread stays `Open` or becomes `Closed` based on the actual work decision

Likewise:

- close reasons are plain comments today
- later they can become structured comment/activity types if helpful

## Assignment, Claims, and Concurrency

These rules are important and should be implemented explicitly.

### Assignee

Each thread has zero or one assignee.

`Thread.assignee?: Cat`

This represents overall responsibility, not necessarily what the cat is doing this second.

Preferred UI wording:

- `Assigned to Mochi`

Avoid:

- `Owned by Mochi`

### Session claims

Sessions can claim threads during active work.

Use:

- `Session.claimedThreads`

Do not split this into `primaryThread` and `relatedThreads` in the core model.

If the UI wants to visually emphasize one thread, that can be derived.

`Session.claimedThreads` should support zero or more claimed threads in the core model.

### Atomic claim rule

`claimThread` must be atomic.

A thread can only be claimed by one active session at a time.

Because each session belongs to exactly one cat, this means only one cat can actively work a claimed thread at a time.

### Restrictions while claimed

While a thread is claimed by an active session:

- only the claiming cat can change the thread status
- reassignment is not allowed
- other cats cannot claim it

This is the main hard concurrency rule in the current model.

### Why no `In Progress`

`In Progress` was explicitly rejected as a core thread status.

Reasons:

- it mixes durable work state with ephemeral activity state
- it goes stale easily
- the same information can be represented more truthfully through active session claims

Humans should understand "what is being worked on right now" by looking at active sessions and claimed threads, not by reading a persistent status.

### Future policy room

The core model stays flexible.

Later, House policies may optionally enforce stricter behavior such as:

- max claimed threads per session
- max active sessions per cat
- automatic reclaim/resume behavior

Those should be policies layered on top of the core model, not ontology changes.

## Turn Types

OpenKitten should think in terms of turn/session types.

### Thread Turn

A `Thread Turn` is a session where a cat works on one or more claimed threads.

This is normal work execution.

### Memo Turn

A `Memo Turn` is a session where a cat incorporates newly added memos into its own memory.

This turn exists because:

- memos are meant to steer future behavior, not just one normal session
- normal thread turns should not have to split focus between active work and memory incorporation
- each cat should decide how it remembers and interprets the memo

Memo turns may also reshape how the cat organizes its current work, but their primary purpose is memory incorporation.

### Dream Turn

`Dream Turn` is a planned future session type and should remain part of the architecture.

A dream turn is where a cat:

- reads recent work
- reads recent sessions
- reads human feedback and memos
- reads its own memory
- reorganizes and sharpens that memory
- improves future productivity
- gradually evolves its working style or personality

Important guardrails:

- dream turns should mostly read house history and cat memory
- dream turns should mainly write to cat memory
- dream turns should not do normal external work by default

This is one of the most uniquely OpenKitten-native ideas and should be preserved in the roadmap.

## Wake Model

Cats do not run continuously.

They wake, catch up, work, write back, and sleep again.

They should not depend on hidden long-lived runtime memory inside one open session.
Each wake should rehydrate the cat from:

- house facts and history
- cat memory
- wake packet context

### Cat work loop

1. the cat wakes
2. OpenKitten builds a wake packet
3. the cat catches up
4. the cat decides whether and how to act
5. the cat writes durable changes back to the House
6. the cat sleeps again

This work loop should remain stable even as new wake reasons or policies are added.

A wake does not always require work.
A cat may wake, inspect the situation, decide nothing needs doing, and go back to sleep.

### Wake reasons

Wake reason types are fixed by the system, while wake policies are configurable.

Current wake reasons:

- `Heartbeat`
- `Relevant Activity`
- `Human Input`
- `Review Resolved`
- `Thread Available`
- `Recovery`
- `Manual Wake`

Wake reasons should coalesce rather than generating excessive turns.

### Wake policy

Wake reason **types** should remain system-defined.

Wake **policies** should be configurable:

- per house in v1/early versions
- maybe per cat later

OpenKitten should not let users invent arbitrary wake reason taxonomy.

### Wake packet

A wake packet is the briefing OpenKitten gives a cat when a session starts.

It should include summaries and pointers, not the whole world.

Typical contents:

- cat identity and role
- wake reason(s)
- basic house identity/context
- relevant goals and threads
- unread or relevant activity summary
- active rules
- relevant memos
- access handles to whiteboards, cabinets, and files
- links or summaries for recent relevant sessions when useful

The wake packet should stay small enough that cats can query more detail through tools instead of receiving everything eagerly.

## Executors and Sessions

### Core model

- `Executor Type`
  Claude Code, Codex, OpenCode, Cursor, Cline, and future executor families
- `Executor`
  one configured instance of an executor type
- `Session`
  one active or historical turn of a cat on one executor

### Why `Executor`

`Executor` is the chosen concept because it reads better than `Runtime` in UI and docs:

- `Add an Executor`
- `Select an Executor`
- `This cat uses the Repo Executor`

`Runtime` was considered, especially because "cat runtime" sounds good, but it is too overloaded and less clear.

### Executor scope

Executors are intentionally opaque in v1.

OpenKitten should not need to model:

- which machine or host they run on
- which directory they use
- whether they are stateful or ephemeral
- which MCP servers they mount
- which external tools they expose internally

Those are executor-side concerns.

What OpenKitten needs to know is only:

- what executor this is
- how to start a session on it
- which optional session operations it supports
- whether it is available

### Default binding

In v1:

- a house can have many executors
- a cat has one default executor
- a session runs on exactly one executor

Later, OpenKitten may support richer routing or fallback behavior, but the current core model should stay simple.

### Session

A `Session` is one active or historical turn of a `Cat` on an `Executor`.

**Core session fields**

- cat
- executor
- wake reason(s)
- claimed threads
- status
- started at
- ended at
- transcript, if available

**Session status**

- `Running`
- `Interrupted`
- `Completed`
- `Failed`
- `Terminated`

**Important rules**

- sessions are ephemeral
- sessions do not own durable shared memory
- the House records durable outcomes
- sessions may or may not have transcripts

### Transcript

A `Transcript` is the recorded visible output of a session.

Store transcripts:

- faithfully
- executor-native first
- lightly normalized second

Some executors may stream transcript content live.
Some may only provide a full or partial transcript when the session ends.

OpenKitten should not force one deep cross-executor transcript schema in v1.

If normalization exists, it should stay shallow, for example:

- timestamp
- kind
- content

### Minimal executor interface

Required:

- `startSession`

Optional:

- `streamSession`
- `interruptSession`
- `steerSession`
- `resumeSession`
- `terminateSession`
- `getStatus`

`streamSession` is optional because the House still works without live streaming.

`steerSession` is intentionally named as steering, not chat input.

`terminateSession` is better than `endSession` because it clearly means forcefully stop a session before natural completion.

The intended semantics are:

- `interruptSession`
  best-effort stop/pause of the active session with the possibility of follow-up or continuation later
- `terminateSession`
  best-effort hard stop that abandons the session
- `resumeSession`
  continue an interrupted/resumable session, optionally with follow-up guidance
- `steerSession`
  send live session-scoped guidance while the session is still running

Executors may not support all of these operations distinctly.
If an executor only has one native cancel primitive, OpenKitten may need to degrade:

- interrupt into terminate
- resume into a new `startSession` with prior context

The product model should stay stable even when executor support varies.

### Session execution contract

When OpenKitten starts a session, it should give the executor:

- the cat identity
- the wake packet
- access to the house tools that cat is allowed to use

The executor then runs that cat turn and may also expose its own executor-native tools.

The cat logic lives in the model acting as that cat for one session.
The executor is the environment/body that makes that turn possible.

### `startSession` result

`startSession` should return only the minimum OpenKitten needs to continue interacting with the session:

- a native executor session handle or id
- initial session status
- optional initial transcript content

OpenKitten creates and owns the session record in the House. The executor only needs to return the handle and current state needed for later calls.

The UI should only expose the session controls that the current executor/session actually supports.

## House Tools vs Executor Tools

When a cat runs a session, it has access to two tool worlds.

### House tools

House tools are OpenKitten-owned tools that let a cat inspect and mutate the House.

Typical families:

- read/search goals, threads, comments, activities, memos, rules, notices, sessions
- read/write whiteboards
- list cabinets and read/write files
- claim and release threads
- add comments
- close threads
- create or trigger human attention flows that may generate notices

These are the tools that make a session feel like "a cat acting in the House" instead of "a generic external agent run."

### Executor tools

Executor tools are real-world capabilities supplied by the executor runtime.

Examples:

- terminal access
- browser access
- editor or repo tools
- OS resources
- external services
- executor-specific integrations

OpenKitten should not try to re-model all executor tools in the core ontology.

Executor adapters will likely remain somewhat bespoke. OpenKitten should standardize only the thin session contract and preserve executor-specific behavior outside the core ontology when needed.

### Human-only actions

Some actions remain human-owned in the current model, especially:

- creating/updating/closing goals
- creating/archiving rules
- creating memos
- resolving human judgment calls

The general philosophy is:

- cats can generally see and do most things in the house
- human-only actions remain reserved

Broad visibility and broad in-house access are the default because that helps cats gather context and make better decisions.

OpenKitten does **not** currently define a heavy formal scope model.

## Cat Memory

### Core principle

The House keeps the facts.
Each Cat keeps its own memory.

This distinction is crucial.

The House may persist cat memory technically, but that does **not** make it "house memory" semantically.

### What cat memory is

Cat memory is the cat's private persistent understanding of how to work in the House.

Examples:

- long-lived reminders
- learned human preferences
- heuristics and habits
- lessons from past work
- recurring patterns
- self-reflection
- evolving working style

### What cat memory is not

- not shared house memory
- not raw transcript history
- not the same thing as activity history
- not necessarily executor-local state

### Memory ownership

Memory belongs conceptually to the cat, not to the executor.

Executors may help store or use memory, but the product model should not depend on executor-local memory alone.

### Implementation boundary

Cat memory is a core concept, but memory strategy is intentionally replaceable.

Do **not** bake these details into the core model:

- how memory is stored
- how memory is loaded
- how memory is summarized
- how memory is retrieved
- how memory is written during memo or dream turns
- whether memory is file-based, structured, vector-backed, executor-assisted, or hybrid

Stable promise:

- cats remember
- normal turns can read memory
- memo turns can update memory
- dream turns can reorganize memory

Everything else is a strategy choice.

Normal thread turns may still benefit from cat memory, but they are not the primary place where new human steering should be incorporated.

## Memo Incorporation Model

Memo behavior is important enough to call out explicitly.

### Why memo turns exist

Memo turns exist because a memo should have durable steering effect beyond the next random thread turn.

If memo incorporation were left to normal work sessions alone:

- cats would need to split focus between work and memory
- incorporation would be inconsistent
- memo lifecycle would stay fuzzy

Memo turns solve that.

### Memo batching

Memos should be debounced and grouped before briefing cats.

The exact batching window is a policy/implementation decision.

Expected shape:

- a short debounce window
- likely configurable per house later
- likely somewhere around a few minutes to tens of minutes, not hours

### Targeted incorporation

Only targeted cats should:

- receive the memo turn
- see the memo in their memo flow
- count toward auto-archive completion

Default target:

- all cats in the house

Optional:

- explicitly selected cats

### Archiving

The preferred memo lifecycle is automatic archive after incorporation:

- once all targeted cats have completed the relevant memo turn(s), the memo is archived

Earlier alternatives such as manual-only archive or generic hard expiry were considered, but the current preferred model is to make memo turns define memo completion.

That said, the model should still allow a human escape hatch.
If a targeted cat is unavailable, disabled, failing repeatedly, or no longer relevant, the human should be able to manually archive or otherwise force completion so a memo does not remain active forever.

## Rules and Turn Protocols

Rules stay general.

Do **not** create v1 concepts like:

- rule for thread turn
- rule for memo turn
- rule for dream turn

That wording is unnatural and overcomplicates the model.

Instead:

- rules apply broadly to cat behavior
- specific turn types have built-in protocols

Examples:

- memo turns exist to incorporate human guidance into cat memory
- dream turns exist to reorganize cat memory and improve future behavior

If finer control is needed later, prefer:

- advanced house settings
- or a future concept such as `Ritual`

Do not pollute the current core ontology with turn-specific rule objects.

## Notices and Attention Routing

The relationship between comments, activities, and notices should be explicit:

1. a human or cat writes a comment, or another meaningful event happens
2. the House records an activity
3. if the human should pay attention, the system creates a notice
4. the notice appears in the inbox

This lets OpenKitten keep:

- communication
- durable history
- attention routing

as three separate concerns.

That separation is important.

## Explicitly Deferred or Optional

These are intentionally **not** core v1 concepts, even though they may be added later:

- direct cat chat
- multi-assignee threads
- explicit reviewers on threads
- `Blocked`, `Needs Review`, `Done`, or `In Progress` as core thread statuses
- explicit thread-file ownership
- notebooks and bookshelves as core storage concepts
- house-wide shared memory as the primary memory model
- turn-specific rules
- deep house-level executor governance
- heavy formal scope/ACL models for cats

These ideas may still appear later as:

- notices
- comments
- activities
- policies
- settings
- additional optional objects

but they should not distort the current core model.

## Future Concepts Already Worth Preserving

These ideas are future-facing but important enough to keep explicit room for.

### Dream Turn

Must remain a future roadmap concept.

### Watchers or collaborators

May be added in v1 or later as an optional layer without changing the core model.

They can help represent:

- cats that are interested in a thread but are not the assignee
- humans or cats who want visibility into thread changes

If watch support exists, it is a natural source of notices and inbox activity.
It should complement the core model, not replace assignee or session claims.

### Structured thread actions

May later turn common comments into richer first-class actions:

- request review
- close thread
- handoff
- reassign

### Explicit thread-file links

May later improve UI/search while preserving the core storage model that files live in cabinets.

### House snapshots and time travel

Because OpenKitten owns the House data model, it should remain possible to add:

- house snapshots
- thread history views
- "what changed since..." inspection
- time-travel or restore workflows

This is not a core v1 requirement, but the architecture should not make it impossible.

### Advanced House policies

May later tighten behavior without changing ontology:

- max claimed threads per session
- max active sessions per cat
- memo batching windows
- whether fresh memos appear in normal wake packets before memo turns

### Executor governance

May later exist, likely through executor configuration or adapter-level policy translation, but is intentionally out of scope for v1.

## Engineering Guidance

An engineer starting implementation planning should assume:

### Stable concepts

These should be treated as stable domain concepts:

- house
- human
- cat
- goal
- thread
- comment
- activity
- notice
- inbox
- memo
- rule
- whiteboard
- cabinet
- file
- executor type
- executor
- session
- cat memory

### Stable invariants

These should be implemented explicitly:

- thread assignee is zero or one cat
- session belongs to exactly one cat
- a thread can be claimed by only one active session at a time
- while claimed, only the claiming cat can change thread status and reassignment is not allowed
- goal and thread statuses are `Open | Closed`
- memo and rule statuses are `Active | Archived`
- comments belong to exactly one thread
- comments generate activities
- notices point at underlying work/history objects rather than replacing them

### Replaceable strategies

These should be abstracted behind interfaces and kept easy to swap:

- memory storage/retrieval/update strategy
- rule application strategy
- wake packet construction details
- transcript normalization depth
- executor adapters and executor-specific metadata

### Practical first implementation slices

A reasonable implementation plan can begin with:

1. House state and core objects
2. Goals, threads, comments, activities
3. Inbox/notices
4. Whiteboards, cabinets, files
5. Cats, executors, sessions
6. Wake model
7. Thread claiming invariants
8. Memo creation and memo-turn orchestration
9. Rule injection/application
10. Cat memory backend abstraction

Dream turns can come later, but the architecture should already leave room for them.

## One-Sentence Summary

OpenKitten is a persistent House where human-owned goals, memos, and rules steer autonomous cats; cats work through threads, comments, activities, notices, sessions, and executors; and each cat keeps its own memory that memo turns shape and dream turns eventually refine.
