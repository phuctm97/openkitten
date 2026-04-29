import { authClient } from "~/lib/auth-client";
import { queryClient } from "~/lib/query-client";
import { sessionQueryOptions } from "~/lib/session-query-options";

let started = false;

export function startAuthSessionSync(): void {
  if (started) return;
  started = true;
  let initialized = false;
  let previousSessionId: string | undefined;
  authClient.$store.listen("$sessionSignal", () => {
    const currentSessionId =
      authClient.$store.atoms.session?.get()?.data?.session?.id;
    if (!initialized) {
      initialized = true;
      previousSessionId = currentSessionId;
      return;
    }
    if (currentSessionId === previousSessionId) return;
    previousSessionId = currentSessionId;
    queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey });
  });
}
