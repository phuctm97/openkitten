---
name: shadcn-ui
description: Use when adding or updating shadcn/ui or compatible registry components in packages/world or packages/website. Covers the preferred generation workflow, generated-file exceptions, bundled Radix preference, and required validation.
---

# shadcn/ui

## Workflow

1. Generate from the target package with the installed CLI.
   - Supported targets:
     - `packages/world` for the React Router app
     - `packages/website` for the Next.js app
   - Use `bun --cwd <target> --bun shadcn add ...`
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
   - Run Biome formatting/fixes
   - Respect the package's `components.json` settings instead of normalizing across apps
   - `packages/world/components.json` has `rsc: false`, so remove generated `use client` directives there
   - `packages/website/components.json` has `rsc: true`, so keep client directives when the generator adds them
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

As the final step after integrating components in either target package, run:

- `bun --bun biome check`
- `bun --bun tsc --build`
- `bun run --cwd <target> build`
- `bun run --cwd <target> test --coverage`
