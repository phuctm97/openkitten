# OpenKitten World Client Strategy

## Status

This document captures the current client/framework decision for OpenKitten World and the product positioning that led to that decision.

It exists to answer these questions clearly:

- what kind of product OpenKitten World should be in its early days
- what its long-term north star should be
- what client/game framework best fits that path
- what tradeoffs are accepted now versus deferred for later

This document is intentionally narrower than [Vision](./VISION.md) and [Spec](./SPEC.md).
It focuses on client strategy, framework choice, and presentation direction.

## Product Context

OpenKitten World is the primary world-like product experience that lives at `world.openkitten.com`.

That naming is intentional:

- `OpenKitten` is the brand
- `OpenKitten World` is the larger place users return to
- each `House` is one workspace/home inside that world

This matters because:

- one human may have multiple houses
- multiple humans may share a house
- users are expected to return to the product repeatedly throughout the day
- the product should feel like a place they want to come back to, not just a utilitarian dashboard

`app.openkitten.com` is intentionally left available for a future, more conventional, standard web app surface if OpenKitten ever needs one.

## Product Goals For The Client

The client should support a product that is:

- web-native
- fast to load
- reliable across browsers and devices
- open-source and easy to self-host
- easy for a TypeScript/web-heavy team to build and evolve
- capable of presenting the House as a living, game-like world

The client also needs to work well with the rest of the OpenKitten model:

- async-first interaction
- high observability
- many side panels and structured views
- real-time session streams
- thread, notice, memo, and rule surfaces
- connected external executors

This is not a pure game client.
It is also not a standard SaaS UI.
It is a hybrid product that uses a world-like presentation to make work feel alive.

## Personal / Team Context Behind The Decision

The current primary builder context matters:

- prior game experience exists, but it is old
- the last decade of day-to-day work has been mostly:
  - TypeScript
  - React
  - Node.js / Bun
  - web app and SaaS architecture

So the best client choice is not the one with the most traditional game-engine features in the abstract.
It is the one that best supports building OpenKitten World quickly, well, and sustainably with the team's actual strengths.

## Decision Criteria

The framework choice was evaluated against these priorities:

1. Lowest practical learning curve for a TypeScript/React-heavy team
2. Strong web/browser reliability and performance
3. Good fit for a hybrid product that mixes world rendering with serious app UI
4. Good open-source and self-hosting ergonomics
5. Room to grow toward a richer, more immersive world later
6. Nice-to-have future multi-platform potential, but not a hard v1 requirement

An important clarification emerged during the decision:

- broad multi-platform shipping is desirable
- but it is not a hard requirement for the initial product
- web-native reliability and development leverage matter more right now

## Frameworks Considered

### PixiJS + React

This means:

- `PixiJS` for rendering and interaction
- `React` for product structure, UI composition, and application architecture
- optionally `@pixi/react` for React-native composition of the world layer

Strengths:

- best fit for a TypeScript + React + web-heavy team
- most natural fit for a hybrid app/game product
- easy to keep the product architecture close to a traditional React application
- lets OpenKitten keep one shared application state while presenting it in a world-like way
- leaves open the possibility of later adding other presentation modes on top of the same state

Costs:

- fewer built-in game systems than a full game framework
- some world/runtime conventions will need to be built in-house
- more deliberate client architecture work is required up front

### Phaser

Strengths:

- stronger traditional 2D game framework shape
- more built-in game-oriented systems out of the box
- likely faster to reach a very conventional 2D game feel

Costs:

- more opinionated game architecture
- less naturally aligned with React-first product structure
- less ideal for a product whose core is still a serious async productivity system

### Defold

Strengths:

- strong multi-platform story
- free and royalty-free
- attractive if broad platform shipping becomes a much more urgent goal

Costs:

- much less aligned with current TypeScript/React strengths
- higher effective learning curve
- weaker fit for a web-first product that should feel native to the browser and easy to self-host

## Complexity, Learning Curve, And Cost Comparison

This comparison is intentionally practical and team-relative.
It is not a claim about the absolute quality of each framework.

| Choice | Complexity For OpenKitten World | Learning Curve For A TS/React-Heavy Team | Cost / License |
| --- | --- | --- | --- |
| `PixiJS + React` | Low-medium | Low | Free, open-source, permissive licensing |
| `Phaser` | Medium | Low-medium | Core framework is free and open-source; optional editor/tooling can introduce cost |
| `Defold` | Medium-high | Medium-high | Free, royalty-free |

The key takeaway is:

- `PixiJS + React` has the lowest practical adoption friction for the current team
- `Phaser` is still approachable, but asks the team to think more like a game-framework team
- `Defold` may be attractive strategically, but costs too much in day-to-day stack mismatch right now

## Narrowing To Two Choices

The initial comparison narrowed the field to:

- `PixiJS + React`
- `Defold`

That was based on strategic coverage:

- `PixiJS + React` covered the strongest web-native product path
- `Defold` covered the strongest early multi-platform path

After clarifying that multi-platform shipping is not a hard near-term requirement, the more relevant comparison became:

- `PixiJS + React`
- `Phaser`

That is the real practical top-two for OpenKitten World today.

## Final Framework Decision

OpenKitten World should use:

- `PixiJS + React`

### Why This Is The Right Choice

`PixiJS + React` best matches what OpenKitten World actually is:

- a productivity system
- with a living, game-like presentation layer
- not a conventional game first

This stack makes it possible to build OpenKitten World similarly to a modern React app:

- the core state can remain product-native
- panels, notices, threads, cats, and houses can remain application-first concepts
- the world layer can embody that state visually instead of forcing the product into a scene-first game model
- future alternate presentations over the same core state remain possible, but that is a nice-to-have rather than an early product goal

This is especially valuable because OpenKitten World includes many traditional product surfaces:

- side panels
- inbox / notice surfaces
- thread views
- cat details
- session inspection
- house controls
- settings and configuration

Those are common in games too, but in OpenKitten World they are not secondary.
They are central to the product.

### Why Phaser Is Not The Default Choice

`Phaser` remains a strong alternative, but it is not the best default choice because OpenKitten World is not primarily trying to become:

- a full 2D game
- a JRPG-style world with productivity features attached

If that were the primary product direction, Phaser would become much more attractive.

Instead, OpenKitten World is better understood as:

- a serious productivity system
- embodied as a living world

That framing makes `PixiJS + React` a better match.

## Product Positioning Decision

This was the most important non-technical conclusion of the framework discussion:

OpenKitten World should embrace:

- `a productivity app with a game-like presentation`

and should not, at least initially, embrace:

- `a fully immersive game that happens to do productivity`

This is a strategic product choice, not just a client-framework preference.

## Why The Early Product Should Be Productivity-First

The core value of OpenKitten World is still:

- helping the user get things done

The world layer exists to make the product:

- more alive
- more legible
- more delightful
- more habit-forming
- more emotionally resonant

It does not exist to replace the work model with generic game systems.

This is why the world should serve:

- goals
- threads
- comments
- notices
- memos
- rules
- sessions
- cat observation

rather than overshadow them.

### What This Means In Practice

The early product should not spend its time building:

- heavy RPG infrastructure
- game systems for their own sake
- rich immersion that makes real work slower or harder

Instead, it should build:

- a spatial, living house interface
- cats that feel present and observable
- world-native surfaces for work and coordination
- strong asynchronous product primitives
- enough game-like embodiment to make the system memorable and enjoyable

## The Long-Term North Star

Even though the early product should be productivity-first, the long-term north star should still be much more ambitious:

- a deeply immersive living world for real work

That means the immersive-first direction is not wrong.
It is just better treated as the north star than as the initial center of gravity.

Over time, OpenKitten World can grow toward:

- richer embodiment
- stronger spatiality
- more ambient simulation
- more emotionally expressive cats
- dream-like and ritual-like interactions
- stronger attachment to the House as a place

The point is not to reject immersion.
The point is to grow into it without sacrificing the core product value.

## Reverse Pressure Test: What If OpenKitten World Went Fully Immersive First?

This path was considered seriously.

If OpenKitten World went fully immersive first, it would become something much closer to:

- a living simulation
- a place the user inhabits
- a world where work happens through embodied play

Examples of how that might look:

- the user walks to the mailbox to read notices
- the user visits rooms to see what cats are doing
- memos are placed physically in the house
- dream turns appear as real dream scenes
- executor connections feel like giving cats actual workstations or toolbenches

This path has real strengths.

### Unique Strengths Of The Immersive-First Path

- much stronger emotional attachment
- much stronger differentiation from normal AI products
- a stronger sense of place
- stronger potential for long-term worldbuilding
- more memorable rituals and house identity
- a better chance of becoming a product people leave open because they enjoy being there

### Costs Of The Immersive-First Path

- much more generic game-infrastructure work
- slower validation of the core productivity value
- more friction for dense work interactions
- greater browser and design complexity
- higher risk of building charm before usefulness
- stronger pressure toward a more game-opinionated framework

### What Would Be Missed If OpenKitten Stayed Too Product-Like

This reverse analysis matters because it reveals what the early product should not lose sight of:

- emotional attachment
- stronger sense of place
- ambient legibility
- memorable rituals
- long-term delight

Those are not optional forever.
They are part of what makes OpenKitten World special.

## Synthesis

The best current synthesis is:

- **early product identity**
  productivity system with a game-like presentation
- **long-term north star**
  immersive living world for real work

This is the strategic reason `PixiJS + React` is the best current choice.

It supports:

- building the real productivity product first
- using game-like embodiment where it helps most
- leaving room to become more immersive later

without forcing the product into a traditional game framework before that is justified.

## Pokemon Emerald Reference

`Pokemon Emerald` was used as an aesthetic and experiential reference point:

- readable 2D world
- spatial navigation
- strong sense of place
- calm but alive atmosphere
- layered UI and menus on top of an explorable world

That is a useful inspiration.

However, OpenKitten World should not be interpreted as:

- "Pokemon Emerald, but for productivity"

If building a game very close to Pokemon Emerald itself, a more traditional game framework like `Phaser` would likely be more attractive.

For OpenKitten World, the better framing is:

- a real work system that can borrow some of the clarity, charm, and spatiality of games like Pokemon Emerald

That distinction is important.

## Practical Implications For The Client

Choosing `PixiJS + React` implies these implementation principles:

- keep domain state independent from rendering details
- let the world be one presentation of product state, not the source of truth
- build a spatial, animated, game-like interface on top of the same core model
- keep open the possibility of future alternative UI presentations
- build only the game-like systems that materially improve OpenKitten World

This means OpenKitten should avoid building generic game infrastructure unless it directly supports:

- house legibility
- cat presence
- better observation
- stronger delight
- more intuitive interaction

## What We Are Accepting By Choosing Pixi

This decision intentionally accepts that OpenKitten World may need to build some world-specific client primitives itself rather than taking them all from a full game framework.

That is acceptable because those primitives are more likely to reflect what is uniquely OpenKitten rather than generic game conventions.

The product should spend its complexity budget on:

- the House
- the Cats
- the work model
- the world-like presentation

not on becoming a general-purpose 2D game engine.

## Re-Evaluation Trigger

The framework choice should be revisited only if one of these becomes true:

- the product starts behaving much more like a full game than a hybrid product
- the required world systems become obviously painful to build in Pixi
- browser reliability or performance is not good enough
- the team discovers that a more opinionated game framework would dramatically reduce real product delivery time

Until then, `PixiJS + React` remains the preferred direction.

## Final Decision Summary

OpenKitten World should currently be built as:

- a web-native product at `world.openkitten.com`
- using `PixiJS + React`
- with an early identity of `productivity app with a game-like presentation`
- and a long-term north star of `immersive living world for real work`

That is the current best balance between:

- product usefulness
- implementation leverage
- worldbuilding ambition
- and long-term differentiation
