import type { ExistingSessions } from "~/lib/existing-sessions";

export interface GroupMessage {
  readonly fromName: string;
  readonly fromId: number;
  readonly text: string;
  readonly messageId: number;
  readonly timestamp: number;
  readonly isBot: boolean;
  readonly fileId?: string | undefined;
  readonly fileMime?: string | undefined;
}

function locationKey(location: ExistingSessions.Location): string {
  return `${location.chatId}:${location.threadId ?? 0}`;
}

export class GroupMessageBuffer implements Disposable {
  readonly #buffers = new Map<string, GroupMessage[]>();
  readonly #maxPerChat: number;

  private constructor(maxPerChat: number) {
    this.#maxPerChat = maxPerChat;
  }

  add(location: ExistingSessions.Location, message: GroupMessage): void {
    const key = locationKey(location);
    let buffer = this.#buffers.get(key);
    if (!buffer) {
      buffer = [];
      this.#buffers.set(key, buffer);
    }
    buffer.push(message);
    if (buffer.length > this.#maxPerChat) {
      buffer.splice(0, buffer.length - this.#maxPerChat);
    }
  }

  recent(
    location: ExistingSessions.Location,
    limit?: number,
  ): readonly GroupMessage[] {
    const key = locationKey(location);
    const buffer = this.#buffers.get(key);
    if (!buffer) return [];
    if (limit !== undefined && limit < buffer.length) {
      return buffer.slice(-limit);
    }
    return [...buffer];
  }

  clear(location: ExistingSessions.Location): void {
    this.#buffers.delete(locationKey(location));
  }

  [Symbol.dispose](): void {
    this.#buffers.clear();
  }

  static create(options?: { maxPerChat?: number }): GroupMessageBuffer {
    return new GroupMessageBuffer(options?.maxPerChat ?? 50);
  }
}
