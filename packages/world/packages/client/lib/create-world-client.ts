import type { contract } from "@openkitten/world-contract";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

type WorldClient = ContractRouterClient<typeof contract>;

export function createWorldClient(serverURL: string): WorldClient {
  const link = new RPCLink({
    url: `${serverURL}/rpc`,
    fetch: (request, init) =>
      globalThis.fetch(request, { ...init, credentials: "include" }),
  });
  return createORPCClient<WorldClient>(link);
}
