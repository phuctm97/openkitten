import type { contract } from "@openkitten/bot-contract";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

export function createBotClient(options: {
  readonly url: string;
  readonly token: string;
}): ContractRouterClient<typeof contract> {
  const link = new RPCLink({
    url: options.url,
    headers: () => ({ authorization: `Bearer ${options.token}` }),
  });
  return createORPCClient(link);
}
