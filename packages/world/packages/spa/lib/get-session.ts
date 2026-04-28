import { queryClient } from "~/lib/query-client";
import { sessionQueryOptions } from "~/lib/session-query-options";

export function getSession() {
  return queryClient.fetchQuery(sessionQueryOptions);
}
