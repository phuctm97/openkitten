# OpenKitten World Visual Direction

## Status

This document defines the visual direction for OpenKitten World.

The visual goal is a fullscreen browser game that also carries serious productivity work.

## Core Visual Thesis

OpenKitten World should feel like entering a calm, lovable, working place.

The visual direction should balance:

- game-like presence
- strong readability
- emotional warmth
- serious information handling

The product should not look like:

- a flat SaaS dashboard
- a fake game skin over standard panels
- a noisy gamified productivity toy

## Main Constraint

The main constraint is that the product still needs to carry real information:

- thread state
- notices
- session inspection
- steering actions
- house structure

So the visual direction must make the world more legible, not less.

## Presentation Model

The home route should present:

- a fullscreen world
- no surrounding browser-style chrome
- game-native windows, menus, or HUD when needed
- optional DOM overlays only when they clearly improve clarity

If a UI surface appears on `/`, the first question should be:

- does this feel like part of the House?

not:

- does this look like a nice React card?

## World Grammar

The world should be:

- top-down or lightly angled 2D
- spatially clear
- easy to read at a glance
- rich enough to feel inhabited

The early world should favor:

- one room or one room-like slice
- strong silhouettes
- clear work stations
- visible rest areas
- obvious interaction targets

The user should quickly understand:

- where each cat is
- what kind of place they are in
- where important work objects live

## UI Grammar

UI on the home route should feel game-native by default.

That means:

- windows, inspect surfaces, and HUD elements should feel like they belong to the world
- overlays should have a strong visual language instead of default website framing
- transitions should support the feeling of entering, focusing, and returning

Avoid:

- persistent dashboard sidebars
- a large browser-style header above the game
- a stack of generic translucent cards that overpower the world

If DOM overlays are used, they should still feel deliberate and atmospheric.

## Cat Design Direction

Cats should feel:

- distinct
- warm
- easy to recognize at a distance
- believable as workers inside the House

Early cat design should emphasize:

- strong silhouette
- readable pose
- a few identifying details
- clear active versus resting states

The cats do not need high asset complexity to feel alive.
They need clarity, charm, and enough motion to feel present.

## House And Props

The House should feel like:

- a home
- a workshop
- a place where thinking and doing both happen

Recommended early props:

- desks or worktables
- a whiteboard
- a cabinet
- a notice or inbox area
- resting furniture
- a few small atmospheric objects

Props should support meaning before decoration.

## Motion Direction

Motion should be:

- calm
- soft
- purposeful
- readable

Good early motion includes:

- idle cat breathing or tail movement
- small hover reactions
- gentle inspect transitions
- subtle environmental life

Avoid:

- excessive juice
- busy particle systems
- UI motion that makes reading harder

## Typography And Information Surfaces

Text still matters.

When text appears on `/`, it should feel:

- integrated
- legible
- comfortable for real reading

The goal is not to avoid text.
The goal is to present text in a way that feels native to the House.

That means:

- use information windows sparingly and intentionally
- keep hierarchy strong
- keep reading surfaces focused
- avoid the visual feel of a generic web admin panel

## AI-Assisted Art Direction

AI-assisted art is acceptable for exploration, especially for:

- mood studies
- color direction
- prop concepts
- rough cat variations

But the product should avoid visual incoherence.

Every asset and surface should still answer these questions:

- does it belong to the same House?
- does it preserve readability?
- does it support calm game-first productivity?

## V1 To North Star Design Ladder

### V1

The first convincing version should focus on:

- one strong room
- two readable cats
- a few strong props
- one or two inspection surfaces
- coherent fullscreen presentation

### V2

The next step can add:

- richer animation
- stronger material language
- more expressive cat identity
- better house-to-UI transitions

### North Star

The north star is:

- a rich but calm living House
- game-native productivity surfaces
- stronger atmosphere and attachment
- deeper worldbuilding without losing clarity

## Final Direction Summary

OpenKitten World should look like a serious browser game set inside a lovable House, not like a web app wearing a game costume.
