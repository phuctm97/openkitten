import { authClient } from "~/lib/auth-client";
import { queryClient } from "~/lib/query-client";
import { sessionQueryOptions } from "~/lib/session-query-options";
import { toastError } from "~/lib/toast-error";

let started = false;

export function startAuthSessionSync(): void {
  if (started) return;
  started = true;
  authClient.$store.listen("$sessionSignal", () => {
    queryClient
      .refetchQueries({ queryKey: sessionQueryOptions.queryKey })
      .then(() =>
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] !== sessionQueryOptions.queryKey[0],
        }),
      )
      .catch((error) => {
        console.error("[auth-session-sync] failed to sync session", error);
        toastError(error);
      });
  });
}
