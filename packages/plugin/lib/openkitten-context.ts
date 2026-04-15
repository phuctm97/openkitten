import { createBotClient } from "@openkitten/bot-client";
import { readBotAPIConfig } from "./bot-api-config";

export interface OpenkittenContext {
  readonly api: ReturnType<typeof createBotClient>;
}

export namespace OpenkittenContext {
  export const { ConfigNotFoundError } = readBotAPIConfig;

  export async function create(xdgState?: string): Promise<OpenkittenContext> {
    const config = await readBotAPIConfig(xdgState);
    const api = createBotClient({ url: config.url, token: config.token });
    return { api };
  }
}
