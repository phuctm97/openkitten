import type { contract } from "@openkitten/contract";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { readBotAPIConfig } from "./bot-api-config";

type BotClient = ContractRouterClient<typeof contract>;

export async function createOpenKittenBotClient(
  xdgState?: string,
): Promise<BotClient> {
  const config = await readBotAPIConfig(xdgState);
  const link = new RPCLink({
    url: config.url,
    headers: () => ({ authorization: `Bearer ${config.token}` }),
  });
  return createORPCClient<BotClient>(link);
}
