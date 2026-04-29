import { queryOptions } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";

export function getFullOrganizationQueryOptions(
  organizationId: string | undefined,
) {
  return queryOptions({
    queryKey: ["organizations", "full", organizationId ?? null] as const,
    enabled: !!organizationId,
    queryFn: ({ signal }) => {
      if (!organizationId) {
        throw new Error("organizationId is required");
      }
      return authClient.organization.getFullOrganization({
        query: { organizationId },
        fetchOptions: { signal, throw: true },
      });
    },
  });
}
