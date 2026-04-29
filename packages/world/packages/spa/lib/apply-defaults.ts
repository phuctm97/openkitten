import type { MutationOptions, QueryOptions } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";
import { orgMutationOptions } from "~/lib/org-mutation-options";
import { orgQueryKeys } from "~/lib/org-query-keys";
import { orpcUtils } from "~/lib/orpc-utils";
import { queryClient } from "~/lib/query-client";
import { sessionQueryOptions } from "~/lib/session-query-options";

function applyMutationDefault<TData, TError, TVariables, TContext>(
  options: MutationOptions<TData, TError, TVariables, TContext>,
): void {
  if (options.mutationKey) {
    queryClient.setMutationDefaults(options.mutationKey, options);
  }
}

function applyQueryDefault<TQueryFnData, TError, TData>(
  options: QueryOptions<TQueryFnData, TError, TData>,
): void {
  const queryKey = options.queryKey;
  if (!queryKey) return;
  const defaultsKey = queryKey.length > 1 ? queryKey.slice(0, -1) : queryKey;
  queryClient.setQueryDefaults(defaultsKey, options);
}

export function applyDefaults(): void {
  queryClient.setQueryDefaults(sessionQueryOptions.queryKey, {
    staleTime: 60_000,
  });

  applyQueryDefault(orpcUtils.workspace.sync.queryOptions());

  applyMutationDefault(orgMutationOptions.create());
  applyMutationDefault(orgMutationOptions.delete());
  applyMutationDefault(orgMutationOptions.setActive());
  applyMutationDefault(orgMutationOptions.update());
  applyMutationDefault(orgMutationOptions.inviteMember());
  applyMutationDefault(orgMutationOptions.removeMember());
  applyMutationDefault(orgMutationOptions.updateMemberRole());
  applyMutationDefault(orgMutationOptions.cancelInvitation());
  applyMutationDefault(orgMutationOptions.acceptInvitation());
  applyMutationDefault(orgMutationOptions.rejectInvitation());
  applyMutationDefault(orgMutationOptions.leave());

  queryClient.setQueryDefaults(orgQueryKeys.list, {
    queryFn: ({ signal }) =>
      authClient.organization.list({ fetchOptions: { signal, throw: true } }),
  });
}
