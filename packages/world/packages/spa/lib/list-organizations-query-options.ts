import { queryOptions } from "@tanstack/react-query";
import { authClient } from "~/lib/auth-client";
import { orgQueryKeys } from "~/lib/org-query-keys";

export const listOrganizationsQueryOptions = queryOptions({
  queryKey: orgQueryKeys.list,
  queryFn: ({ signal }) =>
    authClient.organization.list({
      fetchOptions: { signal, throw: true },
    }),
});
