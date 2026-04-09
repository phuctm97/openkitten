# OpenKitten World Client Strategy

## Status

This document defines the client architecture for OpenKitten World.

The package is built around:

- Phaser as the primary runtime for `/`
- React Router for routing and route composition
- React for non-game routes and text-heavy work surfaces that are clearer in DOM
- Jotai as a narrow shared-state bridge when needed

## Product Framing

OpenKitten World should be treated as:

- a serious productivity system
- presented primarily as a game-like world
- with `/` acting as the fullscreen home experience

The distinction matters because it determines who owns the main runtime:

- Phaser owns the home route
- React becomes supporting infrastructure around that route

## Route Model

The route model is:

- `/` renders a fullscreen Phaser experience
- other routes may remain normal React pages
- React Router still owns navigation
- React DOM work surfaces on `/` are allowed when they materially improve reading, writing, or accessibility

This means OpenKitten can have both:

- a strong game-first home route
- conventional web routes for flows that are better served by traditional UI
- React-rendered work surfaces that still feel native to the House

Examples of likely React routes:

- auth
- settings
- legal or marketing-adjacent pages
- 404 pages
- future operational dashboards, if they exist

Those routes should not force `/` to become a dashboard-shaped application.

## Why Phaser Fits

Phaser fits the product because the home route needs a real game runtime at its center.

The core benefits are:

- a scene-oriented mental model
- built-in support for cameras, input, timing, tweens, and common game structure
- a clearer place for game-native UI and HUD layers
- a better fit for a fullscreen, game-first browser route

Most importantly, Phaser encourages the right architectural question:

- how should the House behave as a playable world?

instead of:

- how should a React page render a world-shaped component?

## What React Still Owns

React is still important.
It just should not own the core `/` runtime.

React should continue to own:

- routing
- non-game routes
- text-heavy work surfaces on `/`, such as inboxes, threads, transcripts, and comment composers
- traditional forms or operational pages
- overlays and panels that are materially more readable in DOM
- shared product code that does not belong to the frame loop

This keeps OpenKitten flexible without forcing the main route back into dashboard mode.

## Recommended Split On `/`

The preferred split on the home route is:

- Phaser owns the House, cats, props, camera, hover, selection, and visible reactions
- Phaser owns the transitions and effects that make the route feel spatial and alive
- React owns the dense reading and writing surfaces that benefit from native DOM behavior

In practice, this means:

- Phaser should usually render in-world affordances, lightweight HUD, selection states, and short summaries
- React should usually render inbox views, thread views, session transcripts, detailed cat panels, and comment or memo forms
- large reading surfaces should usually stay in stable screen space instead of chasing moving world objects
- world-anchored DOM should be reserved for small labels, callouts, or compact contextual controls

## State Boundary Between Phaser And React

The cleanest model is:

- Phaser owns the real-time scene, frame loop, input handling, and world-first presentation on `/`
- the domain model stays renderer-agnostic
- React and Phaser only share state through a narrow explicit boundary

Jotai is a reasonable bridge for that boundary when needed.

The preferred usage is coarse-grained:

- selected object state
- navigation intent
- inspector target
- opened work surface
- maybe a small shared session or notice summary
- optional anchor metadata for small world-attached callouts

The preferred usage is not:

- React driving the game loop
- Phaser and React constantly mutating the same fine-grained UI state
- making the home route depend on tightly coupled cross-runtime chatter

## Architectural Consequences

This decision implies:

- no surrounding product chrome on `/`
- no permanent "app shell plus game viewport" layout
- a neutral React root that can host both game and non-game routes
- Phaser should own the world-facing interaction grammar on `/`
- React work surfaces may occupy substantial screen space when the user is reading or writing, but they should still feel subordinate to the House

The home route should feel like entering the House, not opening an admin console.

## Risks And Guardrails

Choosing Phaser means accepting:

- more game-specific architecture
- less default leverage from standard React UI patterns on the home route
- a higher bar for UI, input, and asset discipline
- a need to think carefully about what belongs in-game versus in DOM

The key guardrail is:

- React work surfaces should feel like part of the House, not a dashboard pasted over it

That trade is acceptable because the primary product risk is not browser delivery.

It is:

- can the product feel like the world it needs to be?

## Decision Summary

OpenKitten World should move forward with:

- Phaser as the primary runtime for `/`
- React Router as the routing layer
- React pages for routes that are not primarily game experiences
- React-rendered work surfaces on `/` for dense reading and writing where DOM is clearly better
- Jotai only as a narrow bridge when Phaser and React truly need shared state
