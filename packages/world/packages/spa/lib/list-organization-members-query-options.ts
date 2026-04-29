import { queryOptions } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";

export function listOrganizationMembersQueryOptions(
  organizationId: string | undefined,
) {
  return queryOptions({
    queryKey: ["organizations", "members", organizationId ?? null] as const,
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
