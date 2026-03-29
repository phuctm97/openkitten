import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";

export class NestingSessions {
  readonly #opencodeClient: OpencodeClient;

  private constructor(opencodeClient: OpencodeClient) {
    this.#opencodeClient = opencodeClient;
  }

  async resolve(sessionId: string): Promise<string> {
    const { data: session } = await this.#opencodeClient.session.get(
      { sessionID: sessionId },
      { throwOnError: true },
    );
    if (!session.parentID) return sessionId;
    return this.resolve(session.parentID);
  }

  static create(opencodeClient: OpencodeClient): NestingSessions {
    return new NestingSessions(opencodeClient);
  }
}
