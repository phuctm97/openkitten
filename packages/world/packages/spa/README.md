# OpenKitten World SPA

The browser client for OpenKitten World — one app on `world.openkitten.com` with separate `app` and `game` route trees over a shared core.

See `packages/world/drafts/` for the canonical product, vision, and architecture documents.

## Conventions

### Navigation: use `navigateAtom`, not `useNavigate`

All navigation calls in this package must go through the jotai-based `navigateAtom` from `~/lib/navigate-atom`. Do not import `useNavigate` from `react-router` in component or library code.

```ts
import { useSetAtom } from "jotai";
import { navigateAtom } from "~/lib/navigate-atom";

function Component() {
  const navigate = useSetAtom(navigateAtom);

  function onSuccess() {
    navigate("/workspace/members");
    // or: navigate("/auth/sign-in", { replace: true });
    // or: navigate("/", { wait: true }); // resolves once URL changes
  }
}
```

**Why this rule exists**

- The atom centralizes the navigator so non-React code (utility functions, async handlers, store listeners, jotai write atoms) can navigate without needing component context.
- `navigateAtom` supports options that `useNavigate` does not: `wait` (resolve once the destination URL is reached) and `count` (no-op if the navigation count changed mid-flight, useful for canceling stale redirects).
- Mixing `useNavigate` and `navigateAtom` makes shared navigation utilities inconsistent and harder to test.

**Exceptions**

- `components/jotai-connector.tsx` is the source of truth — it calls `useNavigate()` once and writes the result into `navigatorAtom`. Do not duplicate this elsewhere.
- React Router `clientLoader` redirects continue to throw `replace("/path")` (or `redirect(...)`) because loaders run before the atom is hydrated.

#### Use `wait: true` when a button-loading state should hold through navigation

When a mutation's success handler navigates and the trigger is a button that shows a spinner during the mutation, `await` the navigation with `wait: true`. The atom resolves only once the destination URL is reached, so the mutation stays in `isPending` (and the spinner stays visible) through the route change. Without it, the spinner flickers off the moment the mutation resolves but before the new page renders, which looks broken.

```ts
const { mutate, isPending } = useMutation({
  mutationFn: deleteWorkspace,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    await navigate("/", { wait: true });
  },
});

<Button onClick={() => mutate()} disabled={isPending}>
  {isPending && <Spinner />}
  Delete workspace
</Button>
```

### Data fetching: one `useQuery` per component, render every state

Each component may call `useQuery` at most **once**. If it does, it must render every reachable state of the query — no silent loading, no implicit "data may be undefined" gates downstream. The required states are:

- `isPending` — initial fetch with no data yet → render a `Spinner` (or a higher-level loading shell).
- `isError` + `error` + `refetch` + `isRefetching` → render `<QueryErrorAlert>` from `~/components/query-error-alert`. The alert formats the error via `getErrorMessage` from `@openkitten/world-util` and exposes a retry button wired to `refetch`. While the retry is in flight, `isRefetching` disables the button and swaps a `Spinner` in.
- success → render the actual content from `data`.

```tsx
import { useQuery } from "@tanstack/react-query";
import { QueryErrorAlert } from "~/components/query-error-alert";
import { Spinner } from "~/components/ui/spinner";
import { orpcUtils } from "~/lib/orpc-utils";

export function HouseHeader() {
  const { data, isPending, isError, error, isRefetching, refetch } = useQuery(
    orpcUtils.workspace.sync.queryOptions(),
  );

  if (isPending) return <Spinner />;
  if (isError) {
    return (
      <QueryErrorAlert
        error={error}
        isRefetching={isRefetching}
        onRetry={() => refetch()}
        title="Couldn't load this house"
      />
    );
  }
  return <h1>{data.house.name}</h1>;
}
```

**Why this rule exists**

- Forcing every consumer to handle `isError` + `refetch` removes the failure mode where a transient network blip leaves the user staring at a stale header with no way out except a hard reload.
- A single `useQuery` keeps the loading/error story per component obvious. Components that need data from two queries should be split, or the parent should fetch and pass props down — not multiplex states inline.
- Routing error messages through the shared `getErrorMessage` helper means the same fallback string ("An unknown error occurred") shows up everywhere instead of "[object Object]" leaking through one rogue component.

**Exceptions**

- Routes whose `clientLoader` already gates rendering on `authenticate(...)` may rely on the loader to short-circuit unauthenticated states, but the post-auth `useQuery` still renders all four states.
- `authClient.useSession()` is not a `useQuery` and is not subject to this rule. It exposes its own typed hook from better-auth.

### State: jotai over React context

Cross-cutting client state lives in jotai atoms under `~/lib/*-atom.ts`. Each atom file has exactly one export. Read with `useAtomValue`, write with `useSetAtom`, both with `useAtom`. Hydrate router state via `JotaiConnector` at the root.

### Auth: use `authClient.useSession()`, not `useSession` from `@better-auth-ui/react`

`@better-auth-ui/react` re-exports a session hook typed against the bare `AuthClient` type, which strips plugin-extended fields like `activeOrganizationId`. Use `authClient.useSession()` directly — it preserves the inferred plugin types.

### Files & exports

- One export per file. The kebab-case file name must match the camelCase/PascalCase export name (`get-active-organization-id.ts` exports `getActiveOrganizationId`, `query-error-alert.tsx` exports `QueryErrorAlert`). A colocated `Props` interface is allowed; the file name still tracks the component/function, not the interface.
- `app/routes/*` files export a default React Router route component plus optional `clientLoader` / `clientAction`.
- `lib/*-query-options.ts` files export a single `QueryOptions` value or factory function for use with TanStack Query.

### Components folder is registry-generated only; hand-written components live in `lib/`

`components/` is reserved for files emitted by component-registry CLIs. Each registry owns its own subfolder and rewrites files in place on upgrade — treat the contents as generated code:

- `components/ui/` — shadcn/ui primitives (managed by the shadcn CLI via `components.json`).
- `components/auth/`, `components/settings/`, `components/user/` — better-auth-ui registry output (managed by the better-auth-ui CLI). Don't refactor their layout; the CLI's next sync will put them back.

**Don't add hand-written components to `components/`** — not even at the top level, and not in a new subfolder. If you author a component yourself, it belongs in `lib/`.

#### Layout rule for hand-written (custom) components in `lib/`

- **Custom components used by 2+ routes → flat in `lib/`.** Direct children of `lib/`, one file per component, file name matches the component name (`query-error-alert.tsx` → `QueryErrorAlert`).
- **Custom components used by exactly one route → `lib/<route-name>/<component>.tsx`.** The folder name is the page/route name (e.g. `lib/workspace/`, `lib/accept-invitation/`). One folder per single-route surface.
- **Function/utility files (`.ts`, no JSX) always stay flat in `lib/`** regardless of how many routes consume them. The folder split is a component-organization rule, not a logic-organization rule.
- **This rule does not apply to registry-generated components.** They stay wherever the registry CLI wrote them, even if a given file is used by only one route. Reshuffling them breaks the next CLI sync.

```
lib/
├── query-error-alert.tsx        ✓ multi-route custom component
├── loading-state.tsx            ✓ multi-route custom component
├── jotai-connector.tsx          ✓ root layout custom component
├── create-game.ts               ✓ function file — always flat
├── format-error.ts              ✓ function file — always flat
└── <route>/<component>.tsx      ✓ single-route custom component
components/
├── ui/                          ✓ shadcn — CLI-managed
├── auth/                        ✓ better-auth-ui — CLI-managed
├── settings/                    ✓ better-auth-ui — CLI-managed
└── user/                        ✓ better-auth-ui — CLI-managed
```

**Why this rule exists**

- Registry CLIs assume ownership of their target folder and overwrite or relocate files on upgrade. Mixing custom components into the same tree invites silent loss when the CLI runs.
- A flat `lib/` plus per-route subfolders for custom components keeps the import path predictable: `~/lib/<x>` is a multi-route helper or a utility; `~/lib/<route>/<x>` is feature-scoped to one route; `~/components/<registry>/<x>` is generator output. No "where do I put this?" debate.
- The function-files-stay-flat carve-out keeps utilities, hooks, atoms, and query-options factories at one well-known location even when only one screen uses them today — those move from "single-page" to "multi-page" cheaply, and reshuffling the path on every promotion is churn.

## Commands

Run from this directory:

- `bun run dev` — start the local browser client
- `bun run build` — production build
- `bun run test` — run the SPA test suite
- `bun --bun tsc --build` — TypeScript build check
