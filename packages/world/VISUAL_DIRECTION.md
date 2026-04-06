# OpenKitten World Visual Direction

## Status

This document captures the current visual, aesthetic, and interaction-direction references for OpenKitten World.

It answers these questions:

- what the world should generally look and feel like
- which games are the strongest references right now
- what kind of UI structure best fits OpenKitten World
- how much visual ambition is realistic for a small, AI-assisted production pipeline
- what the near-term execution style should be versus the long-term north star

This document is a companion to:

- [Vision](./VISION.md)
- [Spec](./SPEC.md)
- [Client Strategy](./CLIENT_STRATEGY.md)

## Core Visual Thesis

OpenKitten World should be:

- `2D` or `2.5D`
- warm
- readable
- cozy
- playful
- world-like
- comfortable to look at for long stretches of time

It should not be:

- harshly gamified
- visually noisy
- text-hostile
- pixelated in a way that makes work harder
- dependent on a large custom art team to feel good

The product needs to support a very particular combination:

- lots of reading
- lots of writing
- lots of observation
- frequent panel and menu navigation
- long sessions throughout the day

That means visual charm cannot come at the expense of comfort.

## Main Constraint

OpenKitten World is not being built with a large in-house art and animation team.

So the visual direction must work well under these constraints:

- graphics should be relatively simple
- animation should be selective and high-value rather than constant and elaborate
- assets should be feasible to generate or bootstrap with AI assistance
- the world should still feel alive, lovable, and intentional even with a limited asset budget

This is not a weakness.
It is an important design constraint that should shape the visual system from the start.

## Primary Reference Hierarchy

The current reference hierarchy is:

### Near-Term Execution References

- `Swordtail`
- `Cow Castle`

These are the strongest short-term build references because they appear to hit the practical sweet spot:

- simple and functional world/UI structure
- readable, easy-on-the-eyes presentation
- non-pixel UI that can support real reading and writing
- simple, lovable characters
- relatively modest graphics and animation demands
- strong potential for AI-assisted asset generation

These references are especially valuable because they show how OpenKitten World can feel:

- warm
- friendly
- alive
- playful

without needing extremely dense graphics or high-end animation.

### North Star Experience Reference

- `Cozy Grove: Camp Spirit`

This is the strongest current north star reference.

It captures many qualities OpenKitten World should eventually aim for:

- warmth
- coziness
- soft readability
- emotional attachment
- gentle charm
- ambient life
- many small interaction details that make the world feel good

It is especially important because it demonstrates that a game can feel:

- functional
- serious enough to spend real time in
- cozy
- warm
- playful
- lovable
- immersive

without needing an aggressive or visually exhausting presentation.

OpenKitten World should not try to match Cozy Grove immediately.
But it should grow toward that level of warmth, polish, and ambient delight over time.

### Structural World Grammar Reference

- `Pokemon Emerald`

This remains an important reference, but for a more specific reason:

- world readability
- top-down / 2D world grammar
- spatial clarity
- simple navigation logic
- intuitive room and route structure

`Pokemon Emerald` is not the main rendering-style target.
Its pixel-art UI and text treatment are not right for OpenKitten World.

It should be treated mainly as a reference for:

- how a world can be legible
- how spaces can be clear and memorable
- how the user can intuitively understand where things are

## Composite Direction

The best current synthesis is:

- `Pokemon Emerald` for spatial readability and world grammar
- `Swordtail` and `Cow Castle` for feasible world/UI structure and character simplicity
- `Cozy Grove: Camp Spirit` for long-term warmth, life, and polish

In short:

OpenKitten World should aim for the:

- clarity and production feasibility of `Swordtail` / `Cow Castle`
- spatial readability of `Pokemon Emerald`
- emotional richness and ambient delight of `Cozy Grove`

That is the current best design brief.

## Visual Style Principles

### 1. Non-Pixel Interface

The interface should not be pixelated in a way that makes it tiring to:

- read notices
- read threads
- inspect sessions
- navigate side panels
- type comments, memos, and rules

This is one of the clearest constraints in the visual direction.

The world can still borrow some retro-like simplicity or top-down structure, but the UI and text surfaces should remain:

- crisp
- soft
- easy on the eyes
- modern enough for long-form daily use

### 2. Simple Shapes, Strong Silhouettes

Characters, props, and rooms should read clearly without requiring extremely detailed art.

This means favoring:

- simple shapes
- strong silhouettes
- easily distinguishable room objects
- clean separation between world objects and overlay UI

This helps with:

- readability at small sizes
- animation cost
- AI asset generation
- general product clarity

### 3. Soft, Calm, Friendly Presentation

The world should feel:

- cozy
- calm
- gentle
- welcoming

It should not feel:

- hyperactive
- overloaded
- visually aggressive
- overly dark or gritty

Users should be able to leave the product open for long periods without visual fatigue.

### 4. World First, But Work-Safe

The world should feel like a place, not a dashboard.

But the design still needs to support:

- serious reading
- serious decision-making
- observing many moving parts

So every world-facing visual choice should be evaluated against this question:

`Does this make the House feel more alive without making the work harder?`

## Cat Design Direction

The current strongest character-direction references are `Swordtail` and `Cow Castle`.

Their creatures suggest a very good formula for OpenKitten cats:

- simple
- readable
- slightly human-like
- still clearly cat-like
- lightly magical or strange
- expressive without being complex

OpenKitten cats should not feel like:

- realistic cats
- full human office workers
- generic mascot blobs

They should feel like:

- capable house beings
- little coworkers
- magical residents of the House

### Cat Design Principles

- readable silhouette at small size
- clear cat traits: ears, tail, posture, face language
- slightly human-like body language so they can visibly think, work, rest, carry, write, or dream
- simple base body that supports many variants
- limited but expressive faces and poses

### Clothing And Accessories

Clothes and accessories are especially important.

They should provide:

- role signaling
- personality
- visual richness
- easy customization

Examples:

- scarves
- glasses
- aprons
- hats
- satchels
- headphones
- pins
- charms
- notebooks
- keyrings

This makes cats feel much richer without needing a huge number of base models or complex animation systems.

### Personality Through Layers

The right layering system can create a lot of variety from a small visual system:

- base body
- color and pattern variations
- ear and tail variations
- outfit layers
- accessory layers
- pose and emote set

That is ideal for OpenKitten because it allows:

- personalization
- role distinction
- house culture
- future cosmetic richness

without requiring a large art team.

## World And UI Structure

`Swordtail` and `Cow Castle` are the strongest current references for world/UI structure.

This direction appears to fit OpenKitten very well because it supports:

- a clear 2D / 2.5D world
- relatively simple environments
- functional layered UI
- good readability
- light but meaningful interactions

This is exactly the kind of structure OpenKitten World needs.

The world should feel spatial and explorable, but it should not require:

- full RPG-scale maps
- complex navigation systems for their own sake
- heavy simulation detail just to feel legitimate

The world structure should remain:

- readable
- practical
- calm
- easy to build incrementally

## Interaction And Animation Direction

`Cozy Grove: Camp Spirit` is the strongest reference for interaction richness and long-term polish ambition.

Its value is not that OpenKitten should copy its exact visual style.
Its value is that it demonstrates how much life can come from:

- ambient motion
- small reactions
- tiny animation details
- soft interaction feedback
- environmental charm

This is the right north star for OpenKitten's polish direction.

### Early Animation Strategy

In early versions, animation should be:

- limited
- intentional
- high-value

That means prioritizing animation that most improves:

- cat presence
- state legibility
- warmth
- responsiveness

Examples of good early animation targets:

- cat idle loops
- walking and turning
- sleeping / dreaming
- typing / reading / carrying gestures
- subtle room activity
- panel transitions
- hover and selection feedback

### What To Avoid Early

- large numbers of bespoke animations
- high-effort cinematic transitions
- animation that exists only to prove the product is game-like
- visual noise that competes with text-heavy workflows

## AI-Assisted Art Direction

The visual system should be intentionally friendly to AI-assisted asset generation.

That means favoring:

- simple stylized forms
- consistent silhouettes
- limited animation states
- repeatable character structure
- reusable room and prop vocabulary

This is another reason the `Swordtail` / `Cow Castle` direction is so strong.
It appears feasible to produce a lot of value with:

- simple characters
- simple props
- clean rooms
- selective details

rather than requiring a large number of hand-made, highly specific assets.

## V1 To North Star Design Ladder

### V1

OpenKitten World should feel:

- readable
- warm
- simple
- functional
- clearly alive

It does not need to feel deeply immersive yet.

The goal is:

- strong cat identity
- clear world structure
- comfortable UI
- enough motion and charm to make the House feel present

### V2

The world becomes richer through:

- more ambient motion
- more environmental personality
- better transitions
- stronger room identity
- more distinct cat behavior

### North Star

The product grows toward:

- Cozy Grove-level warmth and micro-delight
- stronger emotional attachment to the House
- richer world feedback
- more layered environmental storytelling
- a house that feels deeply alive even when the user is simply observing

The key is that this richness should come on top of a strong functional core, not in place of it.

## Final Direction Summary

OpenKitten World should currently aim for:

- a `2D / 2.5D` world
- `non-pixel`, comfortable, readable UI
- simple but lovable cats inspired by `Swordtail` and `Cow Castle`
- world structure that is simple, functional, and feasible to build
- long-term warmth and polish inspired by `Cozy Grove: Camp Spirit`
- spatial readability informed by `Pokemon Emerald`

The intended balance is:

- serious enough for real work
- playful enough to love
- simple enough to build
- rich enough to grow into something memorable

That is the current visual direction for OpenKitten World.
