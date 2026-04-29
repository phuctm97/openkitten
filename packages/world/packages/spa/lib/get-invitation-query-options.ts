import { queryOptions } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";

export function getInvitationQueryOptions(invitationId: string | undefined) {
  return queryOptions({
    queryKey: ["organizations", "invitation", invitationId ?? null] as const,
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
