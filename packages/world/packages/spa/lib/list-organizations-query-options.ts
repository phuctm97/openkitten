import { queryOptions } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";

export const listOrganizationsQueryOptions = queryOptions({
  queryKey: ["organizations", "list"] as const,
  queryFn: ({ signal }) =>
    authClient.organization.list({
      fetchOptions: { signal, throw: true },
    }),
});
