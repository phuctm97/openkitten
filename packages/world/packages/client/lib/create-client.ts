import type * as contract from "@openkitten/world-contract";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

type Client = ContractRouterClient<typeof contract>;

export interface CreateClientOptions {
  getActiveOrganizationId?: () => string | undefined;
}

export function createClient(
  serverURL: string,
  options: CreateClientOptions = {},
): Client {
  const link = new RPCLink({
    url: `${serverURL}/rpc`,
    headers: () => {
      const activeOrganizationId = options.getActiveOrganizationId?.();
      if (!activeOrganizationId) return {};
      return { "x-active-organization-id": activeOrganizationId };
    },
    fetch: (request, init) =>
      globalThis.fetch(request, { ...init, credentials: "include" }),
  });
  return createORPCClient<Client>(link);
}
