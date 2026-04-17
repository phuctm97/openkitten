---
name: shadcn-ui
description: Use when adding or updating shadcn/ui or compatible registry components in packages/world or packages/website, including preset apply flows and repo-specific integration.
---

# shadcn/ui

## Adding or Updating Components

1. Generate from the target package with the installed CLI.
   - Supported targets:
     - `packages/world` for the React Router app
     - `packages/website` for the Next.js app
   - Use `bun --cwd <target> --bun shadcn add ...`
   - Immediately after each `shadcn add`, run `bun --bun biome check --write <generated-files>` before reviewing or hand-editing the generated output
   - Examples:
     - `bun --cwd packages/world --bun shadcn add button badge separator -o -y`
     - `bun --cwd packages/website --bun shadcn add button badge separator -o -y`
     - `bun --cwd <target> --bun shadcn add button badge separator -o -y`
     - `bun --cwd <target> --bun shadcn add @kibo-ui/theme-switcher -o -y`

2. Add registry configuration first when needed.
   - If a third-party registry is required, add it to the target package's `components.json`
   - Example:
     - `"@kibo-ui": "https://www.kibo-ui.com/r/{name}.json"`

3. Prefer regeneration over hand-recreation.
   - If a generated component needs to be refreshed, rerun the CLI and overwrite it
   - Only hand-edit after generation for minimal repo-specific integration

4. Keep generated file structure intact.
   - Generated files are an exception to the repo's normal single-export preference
   - Multiple exports are allowed if the generator created them

5. Make only minimal repo-specific follow-up changes.
   - Add missing dependencies to the target package's `package.json`
   - If follow-up edits touch generated files again, rerun `bun --bun biome check --write` on the touched files
   - Respect the package's `components.json` settings instead of normalizing across apps
   - `packages/world/components.json` has `rsc: false`, so remove generated `use client` directives there
   - `packages/website/components.json` has `rsc: true`, so keep client directives when the generator adds them
   - If `add` changes theme providers, toggles, or helpers in `packages/world`, remove any `next-themes` assumptions and reconnect them to the world app's existing theme primitives.
   - Add or update tests so coverage stays at 100%

6. Prefer bundled Radix over individual `@radix-ui/*` packages.
   - This repo uses the bundled `radix-ui` package
   - If generated or registry code imports an individual Radix package and the bundled package exposes the same API, switch it
   - Example:
     - `@radix-ui/react-use-controllable-state` -> `radix-ui/internal`

7. Adapt to project types and runtime only where necessary.
   - Keep generated code as close to upstream as possible
   - Examples of acceptable adaptations:
     - use project-native types such as `Theme` from `~/lib/theme`
     - replace `next-themes`-based theme helpers with the world app's `useTheme` hook and theme connector/initializer flow
     - adjust for strict TypeScript settings such as `exactOptionalPropertyTypes`

## Applying Presets

When the user gives a shadcn preset ID or asks to re-apply a preset, treat that as a repo-wide design-system refresh for both app packages unless they scope it more narrowly.

Assume preset-driven diffs are usually intentional. The preset may differ from the last one applied, or the shadcn CLI itself may have changed what it generates since the previous run.

1. Run the preset in both targets.
   - `bun --cwd packages/world --bun shadcn apply --preset <preset> -y`
   - `bun --cwd packages/website --bun shadcn apply --preset <preset> -y`

2. Reformat the regenerated files immediately.
   - Immediately after each `shadcn apply`, run `bun --bun biome check --write` on the touched files before reviewing diffs.

3. Re-apply repo conventions after `apply`.
   - Prefer `@fontsource-variable/*` over `next/font/*`.
   - If `apply` injects `next/font/google` into `packages/website/app/layout.tsx`, remove it and keep the repo's simpler layout shell.
   - If the preset introduces a new font, wire it through `@fontsource-variable/*` imports in CSS instead of `next/font/*`, and add the matching package to the app package's `devDependencies`.
   - If `apply` changes theme providers, toggles, or helpers in `packages/world`, remove any `next-themes` assumptions and reconnect them to the world app's existing theme primitives.
   - In `packages/world/app/entry.client.css` and `packages/website/app/styles.css`, keep `--font-sans` and `--font-heading` as literal font values. Do not leave `--font-sans: var(--font-sans)` or `--font-heading: var(--font-sans)`.
   - Keep font imports and `--font-*` declarations ordered as `sans`, `heading`, `mono`.
   - Keep generated component files formatted with Biome and aligned with repo lint rules.

4. Keep preset and CLI changes unless they conflict with repo conventions.
   - Only revert or edit changes that violate repo conventions.
   - Keep design-system changes introduced by the preset, such as fonts, colors, radius, icon library, component structure, or other upstream generator updates.
   - If the user includes a note about expected changes, use it as extra confirmation, not as the only basis for keeping preset-driven diffs.

5. Summarize the result clearly after cleanup.
   - Call out which changes were fixed to match repo conventions.
   - Separately call out which changes were kept as intentional results of applying the preset or newer CLI output.

## Final Validation

As the final step after integrating components in either target package, run:

- `bun --bun biome check`
- `bun --bun tsc --build`
- `bun run --cwd <target> build`
- `bun run --cwd <target> test --coverage`
