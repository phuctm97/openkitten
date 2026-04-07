# OpenKitten World Vision

## What OpenKitten World Is

OpenKitten World is a living house of cats that helps a human get meaningful work done.

It is not just a chatbot, not just a dashboard, and not just a game with productivity pasted onto it.

It is a persistent world where:

- the human sets direction
- cats pursue goals
- the house makes their work visible
- connected executors let the cats act in the real world

The long-term ambition is to make the product feel like both:

- a serious autonomous work system
- a place the human grows attached to

## The Core Fantasy

The human is not managing tickets in a generic tool.

They are building and guiding a House full of Cats that:

- understand them better over time
- coordinate with each other
- remember differently as individuals
- improve through work, memos, and reflection
- surface what matters without demanding constant micromanagement

This is the OpenKitten fantasy:

- a world of cats
- doing real work
- in a way that feels alive, legible, and enjoyable

## The Product Shape

OpenKitten World should feel:

- asynchronous-first
- observable
- calm
- spatial
- playful without becoming unserious
- game-like without becoming toy-like

The product should not feel like:

- a noisy notification center
- a web dashboard with a canvas in the middle
- a chatbot with cat avatars
- a generic agent IDE with cute branding

The House itself should be the interface.

Important system states should have natural places in that world:

- goals tell the house what outcomes matter
- threads hold durable work
- comments hold async communication
- notices land in the inbox
- whiteboards hold active thinking
- cabinets hold durable artifacts
- sessions show what cats are doing right now

## Why The Home Route Should Feel Like A Game

The main route should feel like entering a place, not opening an app shell.

That means:

- `/` should be fullscreen
- the House should render through a Phaser-driven world
- the world should be the primary runtime, not an embedded visual layer
- most interaction should happen through the game scene and game-native UI
- React DOM on `/` should be optional, minimal, and clearly subordinate to the world

This shift matters because the intended vibe depends on the user feeling present inside a House, not adjacent to one.

## Human Role

The human should mostly work at a high level.

Their primary actions should be:

- define outcomes through goals
- steer through memos
- constrain through rules
- review the inbox
- inspect what the house and cats are doing
- intervene when necessary

The human should not need to constantly DM cats to make progress happen.

OpenKitten World should reward:

- observation
- review
- nudging
- course correction

more than:

- constant live prompting
- low-level micromanagement
- treating the system like a chatbot

## Cat Role

Cats are the main workers of the house.

They should feel like persistent individuals, not disposable runs.

Each cat should have:

- identity
- its own memory
- a default executor
- the ability to wake, catch up, act, and sleep again

Over time, cats should become more capable and more themselves.

That means they should not all share one global memory.
They should interpret guidance differently, remember differently, and improve differently.

## Why The House Matters

`House` is not just flavor.
It shapes the whole product.

It gives OpenKitten World:

- a persistent home instead of a generic workspace
- a place where work objects can live visibly
- room for attachment, growth, and atmosphere
- a world model that can get richer over time without losing clarity

The House should make work feel situated.

Threads are not just rows in a list.
Sessions are not just logs.
Notices are not just badges.
They all live somewhere inside the same place.

## Serious Work, Not Cute Theater

OpenKitten World should be emotionally compelling because it makes real work feel alive, not because it hides weak substance behind mascots.

The cats are not decoration.
They are the product's workers.

The house is not a theme.
It is the product's world model.

The game-like presentation should make the system:

- easier to observe
- easier to remember
- more emotionally resonant
- more pleasant to return to

not less useful.

## Relationship To The Current Bot

OpenKitten World is intentionally separate from the current Telegram-first bot package.

The bot can continue to exist as:

- a lightweight interface
- a notification surface
- a remote steering surface

But the long-term product center of gravity should move toward the House.

The bot is an access point.
The House is the product.

## North Star

The north star is a persistent House that feels like a game world people want to return to, while remaining a serious system for planning, observing, and steering autonomous work.

In that future:

- houses feel alive even when the human is not actively driving them
- cats feel distinct and inspectable
- work objects are visible and understandable in-world
- productivity surfaces feel native to the House instead of pasted on top
- the product remains useful because of the game-like presentation, not in spite of it
