# OpenKitten World Client Strategy

## Status

This document defines the client architecture for OpenKitten World.

The package should be built around:

- one app on `world.openkitten.com`
- separate `app` and `game` route trees
- one shared domain, state, and action layer underneath
- React for app mode and general web infrastructure
- a real game runtime for game mode, likely Phaser

## Product Framing

OpenKitten World should be treated as one product with two complementary surfaces:

- `app` mode for serious, efficient async work
- `game` mode for the embodied House experience

The distinction matters because it determines what should be shared and what should be isolated.

Shared:

- auth
- houses
- cats
- work objects
- actions
- persistence

Isolated:

- route trees
- presentation state
- renderer-specific interaction patterns
- runtime-specific code

## Why One App Is The Right Shape

OpenKitten World should not start as two separate apps on two separate subdomains.

The stronger model is:

- one product
- one account and auth model
- one shared backend
- one shared domain model
- one future desktop and mobile app shell

This matters because the user should feel like they are switching lenses on the same house, not moving between two different products that happen to talk to the same data.

## Route Model

The route model should be mode-first.

Examples:

- `/app/houses/:houseId`
- `/game/houses/:houseId`

Likely supporting routes later:

- `/app/houses`
- `/game/houses`
- `/app/settings`
- `/game/settings`

This keeps the two modes operationally separate while preserving a shared product underneath.

## Why Utility Starts In App Mode

The shared core should become useful in app mode before game mode is expected to carry the product.

App mode should prove:

- inbox review
- thread reading and writing
- session inspection
- cat inspection
- memo and rule flows
- clear steering and feedback loops

This reduces product risk because usefulness is easier to validate and iterate on than world polish.

## Why Game Mode Still Matters

Game mode is not optional branding.
It is how OpenKitten World earns attachment, intrigue, and long-term distinctiveness.

But game mode has to be real enough to stand on its own:

- not a static background
- not a few sprites pasted over a dashboard
- not a world-shaped skin around the same app shell

It should be treated as a proper renderer with its own interaction grammar and quality bar.

## Renderer Ownership

`App` mode should own:

- dense information surfaces
- conventional editing flows
- accessibility-heavy forms
- fast navigation and review

`Game` mode should own:

- spatial house presentation
- animation and movement
- camera behavior
- world-native interaction
- customization and environmental identity

The same actions should still be reachable from both modes, even if the exact affordances differ.

## Shared Core Boundary

The cleanest model is:

- domain types are renderer-agnostic
- actions and mutations are shared
- selectors and view models can serve both modes
- each renderer owns its own local presentation state

The preferred shared state is coarse-grained:

- selected house
- current inspect target
- persisted work objects
- summaries that both modes need

The preferred non-shared state is:

- camera and animation state
- drag and hover state
- modal or panel choreography
- renderer-specific input state

## Why Separate Route Trees Matter

One app should not mean one blended shell.

The `app` routes and `game` routes should be free to diverge in:

- layout
- runtime behavior
- loading strategy
- visual language
- component structure

This prevents:

- dashboard chrome leaking into game mode
- game constraints polluting app mode
- both modes converging into a compromised middle

## Technology Guidance

React Router should remain the routing layer.

App mode can stay conventional React.

Game mode should use a real game runtime with scene, input, and animation primitives.
Phaser is the current likely choice because it fits:

- scene composition
- camera control
- timing and tweening
- input and hit testing
- a browser-first 2D game workflow

But the product decision is stronger than the library decision.
The core requirement is a real game runtime, not one particular brand of runtime forever.

## Operational Consequences

This decision implies:

- one deployment target for the product
- shared auth and session handling
- shared packaging for future Tauri, Electron, or Capacitor apps
- lazy loading so game mode does not burden app mode unnecessarily
- a path to split later if scale demands it, without starting there now

## Risks And Guardrails

The main risk is accidental blending:

- app mode becoming a weak pseudo-game
- game mode becoming a weak pseudo-dashboard

Guardrails:

- keep route trees separate
- keep business logic shared
- keep presentation logic local to each mode
- keep the shared core free of renderer assumptions
- never ask static graphics to do the job of a game

## Decision Summary

OpenKitten World should move forward as one app on `world.openkitten.com`, with separate `app` and `game` routes over a shared core, proving usefulness first and then layering a real House experience on top.
