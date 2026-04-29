import { queryOptions } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";

export function listOrganizationInvitationsQueryOptions(
  organizationId: string | undefined,
) {
  return queryOptions({
    queryKey: ["organizations", "invitations", organizationId ?? null] as const,
    enabled: !!organizationId,
    queryFn: ({ signal }) => {
      if (!organizationId) {
        throw new Error("organizationId is required");
      }
      return authClient.organization.listInvitations({
        query: { organizationId },
        fetchOptions: { signal, throw: true },
      });
    },
  });
}
