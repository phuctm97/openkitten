# OpenKitten World Asset Production Checklist

## Goal

Produce one coherent MVP room slice that feels:

- calm
- warm
- readable
- game-first
- cute without becoming toy-like

The MVP room should communicate:

- two cats in the House
- clear awake versus resting cat states
- a few OpenKitten-significant surfaces
- enough atmospheric props to make the House feel believable

The cats are not tied to desks or rest areas.
Most room props are presentational in the MVP.
The meaningful house objects are:

- `Whiteboard`
- `Cabinet`
- `Inbox` or notice area

## Style Lock

Use these principles in every prompt:

- lightly angled 2D room, not full isometric
- chunky readable silhouettes
- thick clean contour lines
- soft warm indoor lighting
- cozy home-workshop atmosphere
- clear negative space for cats and future UI
- lower saturation than a bright arcade game
- painterly-cartoon texture, but still clean enough for game readability

Use these negative constraints in every prompt:

- no text
- no watermark
- no UI
- no logo
- no photorealism
- no cluttered composition
- no fisheye perspective
- no dark horror mood
- no ultra-glossy mobile-game look

Do not prompt with brand or game names.
Instead, describe the traits you want:

- readable browser-game silhouettes
- playful proportions
- clean 2D shape language
- warm, calmer palette

## Reference Traits From The Provided Images

Use the provided Swordtail and Cow Castle images as reference images for these traits:

- thick dark contour lines
- large heads and compact bodies
- very readable silhouettes at small size
- simple faces with strong eye readability
- soft oval ground shadows under characters and props
- slightly angled 2D presentation instead of flat side view
- props built from a few chunky forms instead of many tiny details
- playful proportions and toy-like clarity

Translate those traits into OpenKitten like this:

- keep the contour clarity
- keep the compact readable proportions
- keep the chunky prop design
- reduce saturation slightly
- move from outdoor grassland into a warm indoor house palette
- replace fantasy-combat tone with cozy productivity-house tone

Do not copy these specific elements from the references:

- crowns
- capes
- weapons
- combat poses
- outdoor grass biome
- brand text or logos

## Reference Image Rule

Use the provided images differently at different stages:

- Step 1: attach the provided reference images to capture line weight, silhouette language, and prop simplicity
- Step 2 onward: attach the approved room shell first, then optionally include the provided reference images as secondary style references
- Cat state generation: attach the approved cat concept first, then optionally include one of the provided character references as a secondary readability reference

Priority order:

- first priority: previously approved OpenKitten asset
- second priority: the provided reference images
- third priority: the written prompt

## Suggested File Layout

When you start saving final approved assets into the repo, use:

```text
packages/world/public/world/v1/backgrounds/house-room-shell-v1.png
packages/world/public/world/v1/backgrounds/house-foreground-trim-v1.png
packages/world/public/world/v1/props/whiteboard-v1.png
packages/world/public/world/v1/props/cabinet-v1.png
packages/world/public/world/v1/props/inbox-station-v1.png
packages/world/public/world/v1/props/desk-v1.png
packages/world/public/world/v1/props/lamp-v1.png
packages/world/public/world/v1/props/rug-v1.png
packages/world/public/world/v1/props/shelf-v1.png
packages/world/public/world/v1/props/cushion-v1.png
packages/world/public/world/v1/props/plant-v1.png
packages/world/public/world/v1/cats/cat-a-awake-v1.png
packages/world/public/world/v1/cats/cat-a-resting-v1.png
packages/world/public/world/v1/cats/cat-b-awake-v1.png
packages/world/public/world/v1/cats/cat-b-resting-v1.png
packages/world/public/world/v1/fx/cat-shadow-v1.png
packages/world/public/world/v1/fx/hover-ring-v1.png
```

If a tool cannot produce transparent backgrounds directly, generate on a flat chroma background and cut it out afterward.

## Minimum Asset Set

This is the smallest useful set for MVP:

- 1 room shell background
- 1 foreground trim overlay
- 3 OpenKitten-significant props
- 5 to 7 atmospheric props
- 2 cats
- 2 states per cat: `awake` and `resting`
- 1 shadow blob
- 1 hover or selection marker

## Production Order

Follow this order exactly.
Do not jump straight into final cats before the room style is locked.

### Step 1: Generate Style Exploration Frames

Goal:
- explore room mood, palette, shape language, and camera angle
- choose one visual direction before making production assets

Input images:
- Image 1 to Image N = the provided reference images, used for outline weight, silhouette readability, and prop simplification only

Output:
- 4 to 8 concept images

Prompt:

```text
Use case: stylized-concept
Asset type: concept frame for a browser game room
Primary request: create a cozy single-room house interior for a game called OpenKitten World, designed as a calm productivity house inhabited by cats
Input images: Image 1 to Image N = style references for contour line weight, compact readable proportions, and chunky prop design; use them for visual language only, not for copying subjects or branding
Scene/backdrop: a lightly angled 2D room interior that feels like a home workshop, with open floor space in the middle, a wall area for a whiteboard, a cabinet, an inbox or notice corner, and a few warm household props
Subject: the room itself, no characters
Style/medium: stylized 2D environment concept art, thick clean contour lines, chunky readable silhouettes, painterly-cartoon finish, clean enough for use as a game background
Composition/framing: one-room composition, fullscreen-friendly, open readable center space, clear prop zones around the edges
Lighting/mood: warm indoor afternoon light, calm, cozy, serious but lovable
Color palette: warm woods, cream walls, soft brass accents, muted greens, dusty orange accents, lower saturation than the reference images
Materials/textures: wood floor, soft rug, paper notes, painted walls, fabric cushions, subtle texture only
Constraints: no characters, no text, no UI, no logo, no watermark, no clutter, not photorealistic, use the reference images for readability and contour style only
Avoid: fisheye perspective, isometric grid look, empty sterile room, glossy mobile-game polish, overly bright neon colors, outdoor grass scene, fantasy combat props
```

Selection rule:
- pick the image with the best room composition and most usable negative space
- do not pick based only on prettiness

### Step 2: Lock The Room Shell Composition

Goal:
- convert the chosen mood frame into a production-friendly room shell
- simplify the composition so cats and props will read clearly

Input images:
- use the selected Step 1 image as the reference image

Output:
- 2 to 4 cleaner room-shell variations

Prompt:

```text
Use case: stylized-concept
Asset type: production room shell background
Primary request: turn this room concept into a clean reusable game room shell for OpenKitten World MVP
Input images: Image 1 = selected room concept used as style and composition reference; optional additional input images = provided reference images used as secondary guides for contour weight and prop simplicity
Scene/backdrop: a single lightly angled room with open central floor space, clear placement for a whiteboard, cabinet, and inbox area, plus a few warm household props near the edges
Subject: the room shell only, no characters
Style/medium: stylized 2D game environment, clean layered background art, thick clean contour lines, readable chunky forms, soft painterly detail
Composition/framing: fullscreen composition, center area kept open for cats, significant objects readable at a glance, no crowded corners
Lighting/mood: warm, calm, inviting, lived-in
Color palette: warm wood, cream plaster, muted green, dusty orange, parchment paper accents
Materials/textures: wood, fabric, paper, ceramic, soft painted wall texture
Constraints: no characters, no text, no UI, no watermark, preserve the overall style of the reference image, simplify clutter, make the room gameplay-readable
Avoid: tiny unreadable objects, high-detail mess, empty blank floor with no personality, harsh shadows
```

Selection rule:
- choose the version that looks most usable as a game scene, not the most detailed one

### Step 3: Produce The Final Room Shell

Goal:
- generate the final base background

Input images:
- use the chosen Step 2 room-shell image as the reference image

Output:
- 1 final room shell

Prompt:

```text
Use case: stylized-concept
Asset type: final game background
Primary request: create the final MVP room shell for OpenKitten World using this approved room composition
Input images: Image 1 = approved room-shell reference; optional additional input images = provided reference images used as secondary guides for contour weight and prop readability
Scene/backdrop: a cozy lightly angled indoor room with open floor space for cats, one readable whiteboard zone, one readable cabinet zone, one readable inbox or notice zone, and a few atmospheric household objects
Subject: the final room shell only
Style/medium: polished 2D game background, clean stylized environment art, painterly-cartoon finish with thick clean contour lines and clear readable silhouettes
Composition/framing: single-screen gameplay background, central negative space, edge props balanced, no object blocking the center
Lighting/mood: warm indoor light, gentle softness, calm productivity atmosphere
Color palette: warm wood, cream, mossy green, dusty amber, muted teal accents
Materials/textures: wood planks, rug, paper, plaster wall, brass lamp, soft fabric
Constraints: no characters, no text, no UI, no watermark, keep the room readable for future sprite placement
Avoid: photorealism, over-rendered brush detail, noisy texture, clutter, high contrast darkness
```

### Step 4: Generate The Whiteboard Asset

Goal:
- create one clearly readable OpenKitten-significant prop

Input images:
- use the approved room shell as style reference

Output:
- 1 whiteboard prop on transparent background if supported

Prompt:

```text
Use case: stylized-concept
Asset type: game prop sprite
Primary request: create a stylized whiteboard prop for OpenKitten World MVP
Input images: Image 1 = approved room-shell reference for style matching; optional additional input images = provided reference images for contour style and chunky readability
Scene/backdrop: isolated prop, transparent background if supported, otherwise plain flat chroma background for cutout
Subject: a warm handmade whiteboard with pinned notes, clipped paper, and a few simple planning marks, designed for a cozy cat-run productivity house
Style/medium: stylized 2D game prop, thick clean contour lines, chunky readable silhouette, painterly-cartoon finish
Composition/framing: single prop centered, front or lightly angled view, readable at game size
Lighting/mood: warm indoor lighting, gentle shadows
Color palette: cream board surface, warm wood frame, muted paper accents, soft green and amber details
Materials/textures: painted wood, cork, paper, clipped notes
Constraints: no text that needs to be read, no logo, no watermark, match the room-shell style
Avoid: tiny illegible notes, photoreal corkboard, glossy plastic office board
```

### Step 5: Generate The Cabinet Asset

Prompt:

```text
Use case: stylized-concept
Asset type: game prop sprite
Primary request: create a stylized cabinet prop for OpenKitten World MVP
Input images: Image 1 = approved room-shell reference for style matching; optional additional input images = provided reference images for contour style and chunky readability
Scene/backdrop: isolated prop, transparent background if supported, otherwise plain flat chroma background for cutout
Subject: a cozy storage cabinet for files and artifacts, with a warm handcrafted feel, slightly whimsical but still believable
Style/medium: stylized 2D game prop, readable chunky silhouette, thick clean contour lines, painterly-cartoon finish
Composition/framing: single prop centered, lightly angled front view, clearly readable door and drawer shapes
Lighting/mood: warm indoor lighting
Color palette: warm walnut wood, parchment labels, muted brass details
Materials/textures: wood grain, label tabs, brass handles, paper tags
Constraints: no text that must be read, no logo, no watermark, match the room-shell style
Avoid: modern office filing cabinet look, metallic realism, clutter explosion, tiny noisy detail
```

### Step 6: Generate The Inbox Or Notice Station

Prompt:

```text
Use case: stylized-concept
Asset type: game prop sprite
Primary request: create a stylized inbox or notice station for OpenKitten World MVP
Input images: Image 1 = approved room-shell reference for style matching; optional additional input images = provided reference images for contour style and chunky readability
Scene/backdrop: isolated prop, transparent background if supported, otherwise plain flat chroma background for cutout
Subject: a cozy notice area or inbox station that can visually represent incoming notices for a cat-run productivity house
Style/medium: stylized 2D game prop, clear silhouette, thick clean contour lines, painterly-cartoon finish
Composition/framing: single prop centered, readable from a slight angle, large enough to read as an important object
Lighting/mood: warm indoor lighting, inviting but purposeful
Color palette: wood, parchment, muted red-orange accents, mossy green notes
Materials/textures: wood board, clipped notes, envelopes, pinned paper, soft fabric or cork touches
Constraints: no readable text, no logo, no watermark, match the room-shell style
Avoid: corporate mailroom feel, realistic paperwork mess, tiny illegible stickers, over-complex silhouette
```

### Step 7: Generate Atmospheric Prop Pack

Goal:
- create presentational objects that make the room feel lived in

Recommended props:
- desk
- lamp
- rug
- shelf
- cushion
- plant

Prompt:

```text
Use case: stylized-concept
Asset type: game prop set
Primary request: create a small matching set of cozy household props for OpenKitten World MVP
Input images: Image 1 = approved room-shell reference for style matching; optional additional input images = provided reference images for contour style and prop simplification
Scene/backdrop: isolated props, transparent background if supported, otherwise plain flat chroma background for cutout
Subject: a warm set of room props including a simple desk, table lamp, rug, wall shelf, floor cushion, and potted plant
Style/medium: stylized 2D game props, painterly-cartoon finish, thick clean contour lines, chunky readable silhouettes
Composition/framing: each prop clearly separated and readable, consistent scale language, suitable for extraction into individual assets
Lighting/mood: warm indoor light
Color palette: warm woods, cream fabric, dusty greens, muted amber accents
Materials/textures: wood, cloth, ceramic, paper, plant leaves
Constraints: no characters, no text, no logo, no watermark, match the room-shell style
Avoid: toy-store saturation, photoreal detail, visual clutter, mismatched object styles
```

If the tool does not separate the props cleanly, regenerate each prop individually instead of forcing a crowded sheet.

### Step 8: Generate Cat A Concept

Goal:
- create the first cat with strong identity and clear state readability

Input images:
- use the approved room shell as style reference

Prompt:

```text
Use case: stylized-concept
Asset type: game character sprite concept
Primary request: create the first cat character for OpenKitten World MVP
Input images: Image 1 = approved room-shell reference for style matching; optional additional input images = provided reference images for contour style, proportions, and small-size readability
Scene/backdrop: isolated character, transparent background if supported, otherwise plain flat chroma background for cutout
Subject: a charming worker cat with a strong readable silhouette, believable as a persistent individual in a cozy productivity house
Style/medium: stylized 2D game character, painterly-cartoon finish, thick clean contour lines, compact proportions, clean readable forms
Composition/framing: full body character sprite, centered, lightly angled side or three-quarter pose that reads clearly in a game scene
Lighting/mood: warm and soft
Color palette: natural cat colors with one or two clear distinguishing accent details
Materials/textures: soft fur, a small accessory if helpful, simple readable markings
Constraints: no text, no logo, no watermark, no human clothing overload, match the room-shell style
Avoid: hyper-detailed fur, anime proportions, mascot costume look, overly busy accessories, combat gear, crown or cape
```

### Step 9: Generate Cat B Concept

Prompt:

```text
Use case: stylized-concept
Asset type: game character sprite concept
Primary request: create the second cat character for OpenKitten World MVP, visually distinct from the first cat
Input images: Image 1 = approved room-shell reference for style matching; optional additional input images = provided reference images for contour style, proportions, and small-size readability
Scene/backdrop: isolated character, transparent background if supported, otherwise plain flat chroma background for cutout
Subject: a second worker cat with a different silhouette, markings, and personality from the first cat, but still part of the same world
Style/medium: stylized 2D game character, painterly-cartoon finish, thick clean contour lines, compact proportions, clean readable forms
Composition/framing: full body character sprite, centered, readable game pose
Lighting/mood: warm and soft
Color palette: natural cat colors, distinct from cat A, with restrained accents
Materials/textures: soft fur, one or two simple identifying details
Constraints: no text, no logo, no watermark, must feel like the same world as cat A
Avoid: copy of cat A, over-accessorized outfit, photoreal fur, chaotic markings
```

### Step 10: Generate Awake State For Each Cat

Goal:
- create the active-looking state without workstation-specific animation

Input images:
- use the approved cat concept as reference image

Prompt:

```text
Use case: stylized-concept
Asset type: game character sprite state
Primary request: create the awake state for this cat for OpenKitten World MVP
Input images: Image 1 = approved cat concept; optional additional input images = provided reference images for silhouette readability and contour style
Scene/backdrop: isolated character, transparent background if supported, otherwise plain flat chroma background for cutout
Subject: the same cat in an awake state, reading as alert and currently doing something, without needing a desk or work animation
Style/medium: stylized 2D game character sprite, same world style as the reference
Composition/framing: full body, same character proportions, readable game pose
Lighting/mood: warm and clear
Color palette: preserve the exact character palette from the reference
Materials/textures: preserve the same fur, markings, and accessory treatment
Constraints: keep identity consistent, eyes open, posture alert, no new props, no text, no logo, no watermark
Avoid: action pose, exaggerated running, dramatic combat energy, changing the cat's identity
```

### Step 11: Generate Resting State For Each Cat

Prompt:

```text
Use case: stylized-concept
Asset type: game character sprite state
Primary request: create the resting state for this cat for OpenKitten World MVP
Input images: Image 1 = approved cat concept; optional additional input images = provided reference images for silhouette readability and contour style
Scene/backdrop: isolated character, transparent background if supported, otherwise plain flat chroma background for cutout
Subject: the same cat in a resting or sleeping state, clearly calmer and inactive, readable mainly from pose and eye treatment
Style/medium: stylized 2D game character sprite, same world style as the reference
Composition/framing: full body, same character proportions, readable game pose
Lighting/mood: warm and soft
Color palette: preserve the exact character palette from the reference
Materials/textures: preserve the same fur, markings, and accessory treatment
Constraints: keep identity consistent, eyes closed or nearly closed, posture relaxed, no bed required, no new props, no text, no logo, no watermark
Avoid: changing the character, flattening the silhouette too much, exaggerated cartoon snoring effects
```

### Step 12: Generate Support Assets

Shadow prompt:

```text
Use case: stylized-concept
Asset type: game support asset
Primary request: create a soft ground shadow blob for small stylized characters and props in a cozy 2D room
Scene/backdrop: isolated asset on transparent background if supported
Subject: a simple soft oval shadow with painterly edges
Style/medium: stylized 2D game asset
Composition/framing: centered single asset
Lighting/mood: soft warm indoor shadow
Constraints: no text, no watermark, simple and reusable
Avoid: hard black ellipse, photoreal shadow detail
```

Foreground trim prompt:

```text
Use case: stylized-concept
Asset type: foreground overlay for a game scene
Primary request: create a subtle foreground trim layer for the OpenKitten World MVP room
Input images: Image 1 = approved room-shell reference
Scene/backdrop: transparent background if supported
Subject: a few foreground leaves, shelf edges, or frame elements that can sit at the front of the room and add depth without blocking gameplay
Style/medium: stylized 2D game overlay, painterly-cartoon finish
Composition/framing: sparse overlay pieces, readable, not cluttered
Lighting/mood: warm indoor light
Constraints: no text, no logo, no watermark, match the room-shell style, keep gameplay visibility clear
Avoid: heavy screen-obscuring foreground, dark vignette, busy ornament
```

## Iteration Prompts

Use these short follow-up prompts when a generation is close but not right.

Make the room warmer:

```text
Keep everything the same, but shift the palette warmer and calmer: more warm wood, cream, and muted amber, less bright green, less toy-like saturation.
```

Open more floor space:

```text
Keep the same room and style, but simplify edge clutter and open more readable floor space in the center for cat placement.
```

Make the object more readable:

```text
Keep the same prop design, but simplify the silhouette and enlarge the main shapes so it reads clearly in a game scene.
```

Make the cat state clearer:

```text
Keep the same cat identity and style, but make the awake versus resting state easier to distinguish through pose, eye treatment, and posture only.
```

Reduce visual noise:

```text
Keep the same composition and style, but reduce tiny decorative details and make the image cleaner and more game-readable.
```

## Approval Checklist

Approve an asset only if all of these are true:

- it matches the same world style as the room shell
- it reads clearly at a smaller game size
- it does not depend on readable tiny text
- it leaves enough negative space for cats and future UI
- it supports the OpenKitten tone: warm, calm, cute, believable
- it looks like part of a house, not a generic office or a toy playset

## Practical Notes For ChatGPT Images And Similar Tools

- Generate room concepts first.
- Lock one room shell before generating props or cats.
- Reuse the approved room shell as a reference image for later generations.
- Reuse the approved cat concept as a reference image for cat states.
- Ask for transparent background when possible.
- If transparency is not supported, use a flat solid background and cut out the asset afterward.
- Prefer a few good assets over a large inconsistent batch.
- When a generation is close, iterate with one change at a time.
