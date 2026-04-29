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

### State: jotai over React context

Cross-cutting client state lives in jotai atoms under `~/lib/*-atom.ts`. Each atom file has exactly one export. Read with `useAtomValue`, write with `useSetAtom`, both with `useAtom`. Hydrate router state via `JotaiConnector` at the root.

### Auth: use `authClient.useSession()`, not `useSession` from `@better-auth-ui/react`

`@better-auth-ui/react` re-exports a session hook typed against the bare `AuthClient` type, which strips plugin-extended fields like `activeOrganizationId`. Use `authClient.useSession()` directly — it preserves the inferred plugin types.

### Files & exports

- One export per file (kebab-case file name, camelCase or PascalCase export name).
- `app/routes/*` files export a default React Router route component plus optional `clientLoader` / `clientAction`.
- `lib/*-query-options.ts` files export a single `QueryOptions` value or factory function for use with TanStack Query.

## Commands

Run from this directory:

- `bun run dev` — start the local browser client
- `bun run build` — production build
- `bun run test` — run the SPA test suite
- `bun --bun tsc --build` — TypeScript build check
