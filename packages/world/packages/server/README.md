# OpenKitten World Server

Backend service for OpenKitten World — Hono + oRPC + Drizzle + Better Auth.

## Schema

Database tables live in `lib/schema/`:

- `auth.ts` — Better Auth tables (regenerated; see below). Includes the `house` family (`house`, `houseMember`, `houseInvitation`) which is Better Auth's `organization` plugin renamed to fit the OpenKitten World "House" vocabulary via `schema.organization.modelName` overrides in `lib/auth.tsx`.
- `relations.ts` — Drizzle `relations()` declarations for cross-table queries

The split between `auth.ts` (tables) and `relations.ts` (relations) is intentional:

- `auth.ts` mirrors the canonical Better Auth schema and is regenerated from the auth config.
- `relations.ts` is the only place we author Drizzle relations, so they are not lost when `auth.ts` is regenerated.

### Regenerating the auth schema

`auth.ts` is generated from `lib/auth.tsx` (the Better Auth config) and **must not be hand-edited**. To regenerate:

```bash
bun run auth:generate
```

This invokes `@better-auth/cli generate` against `lib/auth.tsx` and overwrites `lib/schema/auth.ts`. After running, two manual cleanup steps are required:

1. **Move the `relations(...)` blocks out of `auth.ts` into `relations.ts`** (consolidate with what is already there), and remove the now-unused `import { relations } from "drizzle-orm";` line at the top of `auth.ts`.
2. Run `bun --bun tsc --build` and `bun run test` to confirm the split is clean.

Keep the snake_case TS identifiers the CLI emits (e.g., `house_member`, `house_id`) — the DB columns are `house_id`, and matching TS accessors avoid drizzle field-mapping ambiguity. Existing call-sites already import these names verbatim.

The CLI's behavior:

- Tables generated reflect the plugins enabled in `lib/auth.tsx` at run time. `OPENKITTEN_PASSKEY_ENABLED=1` and `OPENKITTEN_MAGIC_LINK_ENABLED=1` (set in `.env.local`, propagated by the `auth:generate` script) determine which plugins are loaded.
- The `session` table is **not** generated, because `lib/auth.tsx` configures `secondaryStorage` (Redis) — Better Auth stores sessions there exclusively in this configuration.

### Generating SQL migrations

After updating the schema (either through `auth:generate` or by editing schema files), generate the corresponding SQL migration:

```bash
bun run drizzle:generate
```

The migration files land in `drizzle/` and are applied automatically at server startup by `lib/pg-database.ts`.

Do not run `auth:generate` or `drizzle:generate` automatically as part of other workflows — they are explicit, opt-in commands.

## Commands

- `bun run dev` — start the server with watch mode and `.env.local` loaded
- `bun run test` — run the server test suite
- `bun run auth:generate` — regenerate `lib/schema/auth.ts` from `lib/auth.tsx`
- `bun run drizzle:generate` — emit a new SQL migration based on schema diffs
