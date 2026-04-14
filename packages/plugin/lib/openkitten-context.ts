import { Api } from "grammy";
import type { OpenkittenAPI } from "./api";
import { createAPIProxy } from "./api-proxy";
import { Telegram } from "./telegram";

export interface OpenkittenContext {
  readonly botToken: string;
  readonly userId: number;
  readonly telegram: Api;
  readonly api: OpenkittenAPI;
}

export namespace OpenkittenContext {
  export const { ConfigNotFoundError } = Telegram;

  export async function create(
    xdgConfig?: string,
    xdgState?: string,
  ): Promise<OpenkittenContext> {
    const config = await Telegram.readConfig(xdgConfig);
    const telegram = new Api(config.botToken);
    const api = createAPIProxy<OpenkittenAPI>(xdgState);
    return {
      botToken: config.botToken,
      userId: config.userId,
      telegram,
      api,
    };
  }
}
