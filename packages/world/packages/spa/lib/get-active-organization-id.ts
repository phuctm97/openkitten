import { queryClient } from "~/lib/query-client";
import { sessionQueryOptions } from "~/lib/session-query-options";

interface CachedSession {
  session?: { activeOrganizationId?: string | null } | null;
}

export function getActiveOrganizationId(): string | undefined {
  const cached = queryClient.getQueryData<CachedSession>(
    sessionQueryOptions.queryKey,
  );
  return cached?.session?.activeOrganizationId ?? undefined;
}
