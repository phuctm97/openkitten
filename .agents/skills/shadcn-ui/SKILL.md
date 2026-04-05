---
name: shadcn-ui
description: Use when adding or updating shadcn/ui or compatible registry components in packages/world. Covers the preferred generation workflow, generated-file exceptions, bundled Radix preference, and required validation.
---

# shadcn/ui

## Workflow

1. Generate from `packages/world` with the installed CLI.
   - Use `bun --bun shadcn add ...`
   - Examples:
     - `bun --bun shadcn add button badge separator -o -y`
     - `bun --bun shadcn add @kibo-ui/theme-switcher -o -y`

2. Add registry configuration first when needed.
   - If a third-party registry is required, add it to `packages/world/components.json`
   - Example:
     - `"@kibo-ui": "https://www.kibo-ui.com/r/{name}.json"`

3. Prefer regeneration over hand-recreation.
   - If a generated component needs to be refreshed, rerun the CLI and overwrite it
   - Only hand-edit after generation for minimal repo-specific integration

4. Keep generated file structure intact.
   - Generated files are an exception to the repo's normal single-export preference
   - Multiple exports are allowed if the generator created them

5. Make only minimal repo-specific follow-up changes.
   - Add missing dependencies to `packages/world/package.json`
   - Run Biome formatting/fixes
   - Remove `use client` directives if `rsc: false` in `packages/world/components.json`
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
     - adjust for strict TypeScript settings such as `exactOptionalPropertyTypes`

## Final Validation

As the final step after integrating components in `packages/world`, run:

- `bun --bun biome check`
- `bun --bun tsc --build`
- `bun run --cwd packages/world build`
- `bun run --cwd packages/world test --coverage`
