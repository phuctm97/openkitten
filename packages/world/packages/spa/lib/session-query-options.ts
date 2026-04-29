import { queryOptions } from "@tanstack/react-query";

import { authClient } from "~/lib/auth-client";

export const sessionQueryOptions = queryOptions({
  queryKey: ["auth", "getSession", null] as const,
  queryFn: () => authClient.getSession({ fetchOptions: { throw: true } }),
  staleTime: 60 * 1000,
});
