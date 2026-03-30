import type {
  AssistantMessage,
  Event,
  Part,
  TextPart,
} from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import type { Database } from "~/lib/database";
import { Errors } from "~/lib/errors";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammySendText } from "~/lib/grammy-send-text";
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
  readonly #streaming = new Map<string, StreamingMessage>();

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
  }

  // Insert-or-ignore: returns true if we claimed the message first,
  // false if it was already claimed (e.g. by a previous invalidation or update).
  #claim(message: AssistantMessage): boolean {
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
    message: AssistantMessage,
    parts: readonly Part[],
  ): Promise<void> {
    const text = parts
      .filter((part): part is TextPart => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    if (!text) return;
    const { chatId, threadId } = this.#existingSessions.get(message.sessionID, {
      throwIfNotFound: true,
    });
    await grammySendText({ bot: this.#bot, text, chatId, threadId });
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
    this.#streaming.set(message.info.sessionID, structuredClone(message));
  }

  #setStreamingInfo(info: AssistantMessage): void {
    const current = this.#streaming.get(info.sessionID);
    if (!current || current.info.id !== info.id) {
      this.#streaming.set(info.sessionID, {
        info: structuredClone(info),
        parts: [],
      });
      return;
    }
    this.#streaming.set(info.sessionID, {
      info: structuredClone(info),
      parts: current.parts,
    });
  }

  #upsertStreamingPart(part: Part): void {
    const current = this.#streaming.get(part.sessionID);
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
    const current = this.#streaming.get(sessionId);
    if (!current || current.info.id !== messageId) return;
    this.#streaming.delete(sessionId);
  }

  #removeStreamingPart(
    sessionId: string,
    messageId: string,
    partId: string,
  ): void {
    const current = this.#streaming.get(sessionId);
    if (!current || current.info.id !== messageId) return;
    this.#streaming.set(sessionId, {
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
    const current = this.#streaming.get(sessionId);
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
  async #invalidate(sessionId: string): Promise<void> {
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
    if (latest) this.#setStreamingMessage(latest);
    else this.#streaming.delete(sessionId);
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
    const current = this.#streaming.get(sessionId);
    if (!current) return undefined;
    return structuredClone(current);
  }

  async update(event: Event) {
    switch (event.type) {
      case "message.updated": {
        const { info } = event.properties;
        if (info.role !== "assistant") return;
        if (info.time.completed === undefined) {
          this.#setStreamingInfo(info);
          return;
        }
        this.#removeStreamingMessage(info.sessionID, info.id);
        if (!this.#claim(info)) return;
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
        this.#removeStreamingMessage(
          event.properties.sessionID,
          event.properties.messageID,
        );
        break;
      case "message.part.updated":
        this.#upsertStreamingPart(event.properties.part);
        break;
      case "message.part.removed":
        this.#removeStreamingPart(
          event.properties.sessionID,
          event.properties.messageID,
          event.properties.partID,
        );
        break;
      case "message.part.delta":
        this.#applyPartDelta(
          event.properties.sessionID,
          event.properties.messageID,
          event.properties.partID,
          event.properties.field,
          event.properties.delta,
        );
        break;
    }
  }

  async invalidate() {
    const { sessionIds } = this.#existingSessions;
    if (sessionIds.length === 0) return;
    const results = await Promise.allSettled(
      sessionIds.map((sessionId) => this.#invalidate(sessionId)),
    );
    Errors.throwIfAny(results);
  }

  static create(
    bot: Bot,
    database: Database,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
  ): ProcessingMessages {
    return new ProcessingMessages(
      bot,
      database,
      opencodeClient,
      existingSessions,
    );
  }
}
