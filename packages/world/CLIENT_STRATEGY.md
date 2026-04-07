# OpenKitten World Client Strategy

## Status

This document supersedes the earlier `PixiJS + React` recommendation.

The previous phase-1 `PixiJS + React` prototype was useful because it made two things obvious:

- the Pixi API pushed the project toward low-level imperative drawing too early
- a React app shell wrapped around a world renderer did not create the intended vibe

That earlier Pixi direction was not wasted, but the package should now be treated as Phaser-first throughout.

## The New Product Framing

OpenKitten World should now be treated as:

- a serious productivity system
- presented primarily as a game-like world
- with `/` acting as the fullscreen home experience

This is a different framing from "a web product with a world-like presentation layer."

The distinction matters because it changes who owns the main runtime:

- before, React owned the page and the world sat inside it
- now, the game runtime should own the home route and React should become supporting infrastructure

## Why The Decision Changed

The earlier strategy favored the lowest-friction path for a TypeScript and React-heavy team.

That logic was reasonable, but the phase-1 implementation revealed stronger product truth:

- the low-level rendering model felt like friction, not leverage
- `@pixi/react` did not provide the kind of ergonomic ownership the route needed
- the surrounding web UI made the House feel embedded rather than primary
- the intended emotional effect depends on entering a place, not opening a dashboard

The product now looks closer to:

- a full game experience whose purpose is getting real work done

than to:

- a React product with a game-like center panel

## Updated Client Shape

The current preferred route model is:

- `/` renders a fullscreen Phaser experience
- other routes may remain normal React pages
- React Router still owns navigation
- React DOM overlays on `/` are allowed only when clearly useful

This means OpenKitten can have both:

- a strong game-first home route
- conventional web routes for flows that are better served by traditional UI

Examples of likely React routes:

- auth
- settings
- legal or marketing-adjacent pages
- 404 pages
- future operational dashboards, if they exist

Those routes should not force `/` to become a dashboard-shaped application.

## Why Phaser Is Now The Preferred Choice

Phaser is the preferred choice because the project now needs a stronger game runtime at the center of the main route.

The core benefits are:

- a scene-oriented mental model
- built-in support for cameras, input, timing, tweens, and common game structure
- a clearer place for game-native UI and HUD layers
- fewer incentives to treat the world as an embedded renderer
- a better fit for a fullscreen, game-first browser route

Most importantly, Phaser encourages the right architectural question:

- how should the House behave as a playable world?

instead of:

- how should a React page render a world-shaped component?

## Why Pixi Is No Longer The Preferred Choice

`PixiJS + React` no longer matches the current product framing.

The main concerns are:

- too much low-level world construction too early
- too little opinionated support for the kind of game runtime now desired
- a natural tendency to keep React as the primary owner of the experience

If OpenKitten World were still aiming for a hybrid "web app first, renderer second" shape, `PixiJS + React` would remain credible.

That is no longer the plan.

## What React Still Owns

React is still important.
It just should not own the core `/` runtime.

React should continue to own:

- routing
- non-game routes
- traditional forms or operational pages
- optional DOM overlays when they clearly improve readability
- shared product code that does not belong to the frame loop

This keeps OpenKitten flexible without forcing the main route back into dashboard mode.

## State Boundary Between Phaser And React

The cleanest model is:

- Phaser owns the real-time scene, frame loop, input handling, and game-native UI on `/`
- the domain model stays renderer-agnostic
- React and Phaser only share state through a narrow explicit boundary

Jotai is a reasonable bridge for that boundary when needed.

The preferred usage is coarse-grained:

- selected object state
- navigation intent
- inspector target
- maybe a small shared session or notice summary

The preferred usage is not:

- React driving the game loop
- Phaser and React constantly mutating the same fine-grained UI state
- making the home route depend on tightly coupled cross-runtime chatter

## Architectural Consequences

This decision implies:

- no surrounding product chrome on `/`
- no permanent "app shell plus game viewport" layout
- a neutral React root that can host both game and non-game routes
- game-native menus, windows, and inspect flows should be the default on `/`
- DOM overlays should stay optional and lightweight

The home route should feel like entering the House, not opening an admin console.

## Risks We Are Accepting

Choosing Phaser means accepting:

- more game-specific architecture
- less default leverage from standard React UI patterns on the home route
- a higher bar for UI, input, and asset discipline
- a need to think carefully about what belongs in-game versus in DOM

That trade is acceptable because the current product risk is no longer "can the team build a browser app?"

It is:

- can the product feel like the world it needs to be?

## Re-Evaluation Trigger

This decision should be revisited only if one of these becomes true:

- Phaser makes the main route slower or harder to ship than expected
- game-native UI on `/` becomes an obvious liability for readability
- the product drifts back toward a conventional web app with only light world elements
- another framework clearly provides the same game-first feel with materially better delivery speed

## Decision Summary

OpenKitten World should move forward with:

- Phaser as the primary runtime for `/`
- React Router as the routing layer
- React pages for routes that are not primarily game experiences
- Jotai only as a narrow bridge when Phaser and React truly need shared state

The earlier Pixi prototype was not wasted.
It answered the right question by making the wrong-feeling shape visible early enough to change course.
