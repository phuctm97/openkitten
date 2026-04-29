import { queryOptions } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";
import { orgQueryKeys } from "~/lib/org-query-keys";

export function getInvitationQueryOptions(invitationId: string | undefined) {
  return queryOptions({
    queryKey: [...orgQueryKeys.invitation, invitationId ?? null] as const,
    enabled: !!invitationId,
    queryFn: ({ signal }) => {
      if (!invitationId) {
        throw new Error("invitationId is required");
      }
      return authClient.organization.getInvitation({
        query: { id: invitationId },
        fetchOptions: { signal, throw: true },
      });
    },
  });
}
