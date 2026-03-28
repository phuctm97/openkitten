import type {
  EventSessionCreated,
  EventSessionDeleted,
  EventSessionUpdated,
} from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";

export class NestingSessions {
  readonly #opencodeClient: OpencodeClient;
  readonly #parentMap = new Map<string, string | undefined>();
  readonly #rootMap = new Map<string, string>();

  private constructor(opencodeClient: OpencodeClient) {
    this.#opencodeClient = opencodeClient;
  }

  check(sessionId: string): boolean {
    return this.#rootMap.has(sessionId);
  }

  find(sessionId: string): string | undefined {
    return this.#rootMap.get(sessionId);
  }

  resolve(sessionId: string): string {
    const rootSessionId = this.find(sessionId);
    if (!rootSessionId) throw new NestingSessions.NotFoundError(sessionId);
    return rootSessionId;
  }

  async update(
    event: EventSessionCreated | EventSessionUpdated | EventSessionDeleted,
  ): Promise<void> {
    switch (event.type) {
      case "session.created":
      case "session.updated":
        this.#parentMap.set(
          event.properties.sessionID,
          event.properties.info.parentID,
        );
        this.#recomputeRoots();
        break;
      case "session.deleted":
        this.#removeTree(event.properties.sessionID);
        this.#recomputeRoots();
        break;
    }
  }

  async invalidate(): Promise<void> {
    const { data: sessions } = await this.#opencodeClient.session.list(
      {},
      { throwOnError: true },
    );
    this.#parentMap.clear();
    this.#rootMap.clear();
    for (const session of sessions) {
      this.#parentMap.set(session.id, session.parentID);
    }
    this.#recomputeRoots();
  }

  #removeTree(sessionId: string) {
    const stack = [sessionId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || !this.#parentMap.has(current)) continue;
      this.#parentMap.delete(current);
      this.#rootMap.delete(current);
      for (const [childId, parentId] of this.#parentMap.entries()) {
        if (parentId === current) stack.push(childId);
      }
    }
  }

  #recomputeRoots() {
    this.#rootMap.clear();
    for (const sessionId of this.#parentMap.keys()) {
      this.#rootMap.set(sessionId, this.#resolveRoot(sessionId));
    }
  }

  #resolveRoot(sessionId: string): string {
    let current = sessionId;
    const seen = new Set<string>();
    for (;;) {
      const parentId = this.#parentMap.get(current);
      if (!parentId || !this.#parentMap.has(parentId)) return current;
      if (seen.has(parentId)) return current;
      seen.add(current);
      current = parentId;
    }
  }

  static readonly NotFoundError = class NotFoundError extends Error {
    readonly sessionId: string;

    constructor(sessionId: string) {
      super(`No nesting session found: ${sessionId}`);
      this.sessionId = sessionId;
    }
  };

  static create(opencodeClient: OpencodeClient): NestingSessions {
    return new NestingSessions(opencodeClient);
  }
}
