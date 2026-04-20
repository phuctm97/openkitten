import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { readBotAPIConfig } from "./bot-api-config";
import type { contract } from "./contract";

type BotClient = ContractRouterClient<typeof contract>;

export async function createOpenKittenBotClient(): Promise<BotClient> {
  const config = await readBotAPIConfig();
  const link = new RPCLink({
    url: config.url,
    headers: () => ({ authorization: `Bearer ${config.token}` }),
  });
  return createORPCClient<BotClient>(link);
}
