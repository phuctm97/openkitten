import type { contract } from "@openkitten/world-contract";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

type WorldClient = ContractRouterClient<typeof contract>;

export interface CreateWorldClientOptions {
  getActiveOrganizationId?: () => string | undefined;
}

export function createWorldClient(
  serverURL: string,
  options: CreateWorldClientOptions = {},
): WorldClient {
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
  return createORPCClient<WorldClient>(link);
}
