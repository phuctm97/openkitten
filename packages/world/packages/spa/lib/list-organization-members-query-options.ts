import { queryOptions } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";
import { orgQueryKeys } from "~/lib/org-query-keys";

export function listOrganizationMembersQueryOptions(
  organizationId: string | undefined,
) {
  return queryOptions({
    queryKey: [...orgQueryKeys.members, organizationId ?? null] as const,
    enabled: !!organizationId,
    queryFn: ({ signal }) => {
      if (!organizationId) {
        throw new Error("organizationId is required");
      }
      return authClient.organization.listMembers({
        query: { organizationId },
        fetchOptions: { signal, throw: true },
      });
    },
  });
}
