import type { Bot } from "grammy";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { logger } from "~/lib/logger";

interface StreamingMessage {
  readonly info: {
    readonly id: string;
    readonly sessionID: string;
  };
  readonly parts: readonly {
    readonly type: string;
    readonly text?: string;
  }[];
}

interface State {
  inFlight: Promise<void> | undefined;
  messageId: string | undefined;
  sentMessageId: string | undefined;
  sentText: string | undefined;
  text: string | undefined;
  timer: Timer | undefined;
}

export class StreamingMessages implements AsyncDisposable {
  readonly #bot: Bot;
  readonly #existingSessions: ExistingSessions;
  readonly #states = new Map<string, State>();

  private constructor(bot: Bot, existingSessions: ExistingSessions) {
    this.#bot = bot;
    this.#existingSessions = existingSessions;
  }

  #draftId(sessionId: string, messageId: string): number {
    let hash = 0x811c9dc5;
    for (const char of `${sessionId}:${messageId}`) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
    return ((hash >>> 0) % 0x7ffffffe) + 1;
  }

  #normalizeText(text: string | undefined): string | undefined {
    if (!text) return undefined;
    if (text.length <= 4096) return text;
    return `${text.slice(0, 4095)}…`;
  }

  #render(parts: StreamingMessage["parts"]): string | undefined {
    const text = parts
      .filter(
        (part): part is { readonly type: "text"; readonly text: string } =>
          part.type === "text" && typeof part.text === "string",
      )
      .map((part) => part.text)
      .join("\n");
    return text || undefined;
  }

  #state(): State {
    return {
      inFlight: undefined,
      messageId: undefined,
      sentMessageId: undefined,
      sentText: undefined,
      text: undefined,
      timer: undefined,
    };
  }

  #schedule(sessionId: string, state: State): void {
    if (state.timer || state.inFlight) return;
    state.timer = setTimeout(() => {
      state.timer = undefined;
      void this.#flush(sessionId, state);
    }, StreamingMessages.delay);
  }

  async #flush(sessionId: string, state: State): Promise<void> {
    const { messageId, text } = state;
    if (!messageId || text === undefined) {
      this.#states.delete(sessionId);
      return;
    }
    if (state.sentMessageId === messageId && state.sentText === text) return;
    let location: ExistingSessions.Location;
    try {
      location = this.#existingSessions.get(sessionId, {
        throwIfNotFound: true,
      });
    } catch {
      this.#states.delete(sessionId);
      return;
    }
    const draftId = this.#draftId(sessionId, messageId);
    const promise = this.#bot.api.sendMessageDraft(
      location.chatId,
      draftId,
      text,
      {
        ...(location.threadId && { message_thread_id: location.threadId }),
      },
    );
    state.inFlight = promise.then(
      () => {},
      () => {},
    );
    try {
      await promise;
      state.sentMessageId = messageId;
      state.sentText = text;
    } catch (error) {
      logger.warn("Failed to stream Telegram draft message", error, {
        sessionId,
        messageId,
      });
    } finally {
      state.inFlight = undefined;
      if (!state.messageId || state.text === undefined) {
        this.#states.delete(sessionId);
      } else if (
        state.sentMessageId !== state.messageId ||
        state.sentText !== state.text
      )
        this.#schedule(sessionId, state);
    }
  }

  update(streamingMessage: StreamingMessage): void {
    const sessionId = streamingMessage.info.sessionID;
    const messageId = streamingMessage.info.id;
    const nextText = this.#normalizeText(this.#render(streamingMessage.parts));
    if (!messageId || nextText === undefined) {
      const state = this.#states.get(sessionId);
      if (!state) return;
      state.messageId = messageId;
      state.text = nextText;
      return;
    }
    const state = this.#states.get(sessionId) ?? this.#state();
    state.messageId = messageId;
    state.text = nextText;
    this.#states.set(sessionId, state);
    if (state.sentMessageId === messageId && state.sentText === nextText)
      return;
    this.#schedule(sessionId, state);
  }

  async clear(sessionId: string): Promise<void> {
    const state = this.#states.get(sessionId);
    if (!state) return;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
    state.messageId = undefined;
    state.text = undefined;
    await state.inFlight;
    if (this.#states.get(sessionId) === state) this.#states.delete(sessionId);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(
      [...this.#states.keys()].map((sessionId) => this.clear(sessionId)),
    );
  }

  static readonly delay = 100;

  static create(
    bot: Bot,
    existingSessions: ExistingSessions,
  ): StreamingMessages {
    return new StreamingMessages(bot, existingSessions);
  }
}
