import type { AssistantMessage, Event, Part } from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import type { Database } from "~/lib/database";
import { Errors } from "~/lib/errors";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammySendAssistantMessage } from "~/lib/grammy-send-assistant-message";
import * as schema from "~/lib/schema";

interface StreamingMessage {
  readonly info: AssistantMessage;
  readonly parts: Part[];
}

export class ProcessingMessages {
  readonly #bot: Bot;
  readonly #database: Database;
  readonly #opencodeClient: OpencodeClient;
  readonly #existingSessions: ExistingSessions;
  readonly #streamingMessages = new Map<string, StreamingMessage>();
  readonly #unhook: () => void;

  private constructor(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
  ) {
    this.#bot = bot;
    this.#database = database;
    this.#opencodeClient = opencodeClient;
    this.#existingSessions = existingSessions;
    this.#unhook = existingSessions.hook("beforeRemove", ({ sessionId }) => {
      this.#streamingMessages.delete(sessionId);
    });
  }

  // Insert-or-ignore: returns true if we claimed the message first,
  // false if the session is no longer available or the message was already
  // claimed (e.g. by a previous invalidation or update).
  #claim(message: AssistantMessage): boolean {
    if (!this.#existingSessions.check(message.sessionID)) return false;
    const rows = this.#database
      .insert(schema.message)
      .values({
        id: message.id,
        sessionId: message.sessionID,
        createdAt: new Date(message.time.created),
      })
      .onConflictDoNothing()
      .returning({ id: schema.message.id })
      .all();
    return rows.length > 0;
  }

  #unclaim(message: AssistantMessage): void {
    this.#database
      .delete(schema.message)
      .where(eq(schema.message.id, message.id))
      .run();
  }

  async #deliver(
    info: AssistantMessage,
    parts: readonly Part[],
  ): Promise<void> {
    const location = this.#existingSessions.get(info.sessionID);
    if (!location) return;
    const { chatId, threadId } = location;
    await grammySendAssistantMessage({
      bot: this.#bot,
      info,
      parts,
      chatId,
      threadId,
    });
  }

  #getLatestMessage(
    messages: readonly {
      info: AssistantMessage | { role: string };
      parts: Part[];
    }[],
  ): StreamingMessage | undefined {
    const assistants = messages.filter(
      (message): message is StreamingMessage =>
        message.info.role === "assistant" &&
        "time" in message.info &&
        message.info.time.completed === undefined,
    );
    return assistants.reduce<StreamingMessage | undefined>(
      (latest, message) => {
        if (!latest) return message;
        if (message.info.time.created > latest.info.time.created)
          return message;
        if (message.info.time.created < latest.info.time.created) return latest;
        return message.info.id > latest.info.id ? message : latest;
      },
      undefined,
    );
  }

  #setStreamingMessage(message: StreamingMessage): void {
    this.#streamingMessages.set(
      message.info.sessionID,
      structuredClone(message),
    );
  }

  #setStreamingInfo(info: AssistantMessage): void {
    const current = this.#streamingMessages.get(info.sessionID);
    if (!current || current.info.id !== info.id) {
      this.#streamingMessages.set(info.sessionID, {
        info: structuredClone(info),
        parts: [],
      });
      return;
    }
    this.#streamingMessages.set(info.sessionID, {
      info: structuredClone(info),
      parts: current.parts,
    });
  }

  #upsertStreamingPart(part: Part): void {
    const current = this.#streamingMessages.get(part.sessionID);
    if (!current || current.info.id !== part.messageID) return;
    const next = structuredClone(part);
    const index = current.parts.findIndex((item) => item.id === part.id);
    if (index >= 0) {
      current.parts[index] = next;
      return;
    }
    current.parts.push(next);
    current.parts.sort((left, right) => left.id.localeCompare(right.id));
  }

  #removeStreamingMessage(sessionId: string, messageId: string): void {
    const current = this.#streamingMessages.get(sessionId);
    if (!current || current.info.id !== messageId) return;
    this.#streamingMessages.delete(sessionId);
  }

  #removeStreamingPart(
    sessionId: string,
    messageId: string,
    partId: string,
  ): void {
    const current = this.#streamingMessages.get(sessionId);
    if (!current || current.info.id !== messageId) return;
    this.#streamingMessages.set(sessionId, {
      info: current.info,
      parts: current.parts.filter((part) => part.id !== partId),
    });
  }

  #applyPartDelta(
    sessionId: string,
    messageId: string,
    partId: string,
    field: string,
    delta: string,
  ): void {
    const current = this.#streamingMessages.get(sessionId);
    if (!current || current.info.id !== messageId) return;
    const part = current.parts.find((item) => item.id === partId);
    if (!part) return;
    // OpenCode currently streams deltas only for the text field on text parts and
    // reasoning parts.
    if (field === "text") {
      switch (part.type) {
        case "reasoning":
        case "text":
          part.text += delta;
          break;
      }
      return;
    }
    // Add other handlers here if OpenCode starts streaming other delta fields.
  }

  // Fetch messages with an expanding window until we overlap with
  // already-delivered messages or exhaust the history.
  async #sync(sessionId: string): Promise<void> {
    let limit = 10;
    let latest: StreamingMessage | undefined;
    let batch: { info: AssistantMessage; parts: Part[] }[] = [];
    for (;;) {
      const { data: messages } = await this.#opencodeClient.session.messages(
        { sessionID: sessionId, limit },
        { throwOnError: true },
      );
      latest = this.#getLatestMessage(messages);
      batch = messages.filter(
        (m): m is { info: AssistantMessage; parts: Part[] } =>
          m.info.role === "assistant" && m.info.time.completed !== undefined,
      );
      if (messages.length < limit) break;
      const oldest = batch[0];
      if (oldest) {
        const overlap = !!this.#database.query.message
          .findFirst({
            columns: { id: true },
            where: eq(schema.message.id, oldest.info.id),
          })
          .sync();
        if (overlap) break;
      }
      limit *= 2;
    }
    if (!this.#existingSessions.check(sessionId)) return;
    if (latest) this.#setStreamingMessage(latest);
    else this.#streamingMessages.delete(sessionId);
    for (const { info, parts } of batch) {
      if (!this.#claim(info)) continue;
      try {
        await this.#deliver(info, parts);
      } catch (error) {
        this.#unclaim(info);
        throw error;
      }
    }
  }

  streaming(sessionId: string): StreamingMessage | undefined {
    const current = this.#streamingMessages.get(sessionId);
    if (!current) return undefined;
    return structuredClone(current);
  }

  async update(event: Event) {
    switch (event.type) {
      case "message.updated": {
        const { info } = event.properties;
        if (
          !this.#existingSessions.check(info.sessionID) ||
          info.role !== "assistant"
        ) {
          break;
        }
        if (info.time.completed === undefined) {
          this.#setStreamingInfo(info);
          break;
        }
        this.#removeStreamingMessage(info.sessionID, info.id);
        if (!this.#claim(info)) break;
        try {
          const { data } = await this.#opencodeClient.session.message(
            { sessionID: info.sessionID, messageID: info.id },
            { throwOnError: true },
          );
          await this.#deliver(info, data.parts);
        } catch (error) {
          this.#unclaim(info);
          throw error;
        }
        break;
      }
      case "message.removed":
        if (this.#existingSessions.check(event.properties.sessionID)) {
          this.#removeStreamingMessage(
            event.properties.sessionID,
            event.properties.messageID,
          );
        }
        break;
      case "message.part.updated":
        if (this.#existingSessions.check(event.properties.sessionID)) {
          this.#upsertStreamingPart(event.properties.part);
        }
        break;
      case "message.part.removed":
        if (this.#existingSessions.check(event.properties.sessionID)) {
          this.#removeStreamingPart(
            event.properties.sessionID,
            event.properties.messageID,
            event.properties.partID,
          );
        }
        break;
      case "message.part.delta":
        if (this.#existingSessions.check(event.properties.sessionID)) {
          this.#applyPartDelta(
            event.properties.sessionID,
            event.properties.messageID,
            event.properties.partID,
            event.properties.field,
            event.properties.delta,
          );
        }
        break;
    }
  }

  [Symbol.dispose]() {
    this.#unhook();
  }

  async #initialize() {
    const { sessionIds } = this.#existingSessions;
    if (sessionIds.length === 0) return;
    const results = await Promise.allSettled(
      sessionIds.map((sessionId) => this.#sync(sessionId)),
    );
    Errors.throwIfAny(results);
  }

  static async create(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
  ): Promise<ProcessingMessages> {
    const processingMessages = new ProcessingMessages(
      bot,
      database,
      opencodeClient,
      existingSessions,
    );
    await processingMessages.#initialize();
    return processingMessages;
  }
}
