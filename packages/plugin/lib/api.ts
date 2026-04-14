export interface OpenkittenAPI {
  getBotInfo(): Promise<OpenkittenAPI.BotInfo>;
  listSessions(): Promise<OpenkittenAPI.SessionInfo[]>;
}

export namespace OpenkittenAPI {
  export interface BotInfo {
    readonly id: number;
    readonly isBot: boolean;
    readonly firstName: string;
    readonly username: string;
  }

  export interface SessionInfo {
    readonly id: string;
    readonly chatId: number;
    readonly threadId: number | undefined;
    readonly agent: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
  }
}
