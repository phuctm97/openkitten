import invariant from "tiny-invariant";
import type { FloatingPromises } from "~/lib/floating-promises";

interface MediaGroupData {
  readonly entries: MediaGroupBuffer.Entry[];
  timer: ReturnType<typeof setTimeout>;
}

export class MediaGroupBuffer implements Disposable {
  readonly #groups = new Map<string, MediaGroupData>();
  readonly #floatingPromises: FloatingPromises;
  readonly #onFlush: (
    entries: readonly MediaGroupBuffer.Entry[],
  ) => Promise<void>;
  readonly #delay: number;
  #disposed = false;

  private constructor(
    floatingPromises: FloatingPromises,
    onFlush: (entries: readonly MediaGroupBuffer.Entry[]) => Promise<void>,
    delay: number,
  ) {
    this.#floatingPromises = floatingPromises;
    this.#onFlush = onFlush;
    this.#delay = delay;
  }

  add(mediaGroupId: string, entry: MediaGroupBuffer.Entry): void {
    if (this.#disposed) return;
    const existing = this.#groups.get(mediaGroupId);
    if (existing) {
      clearTimeout(existing.timer);
      existing.entries.push(entry);
      existing.timer = setTimeout(() => this.#flush(mediaGroupId), this.#delay);
    } else {
      const timer = setTimeout(() => this.#flush(mediaGroupId), this.#delay);
      this.#groups.set(mediaGroupId, { entries: [entry], timer });
    }
  }

  #flush(mediaGroupId: string): void {
    const group = this.#groups.get(mediaGroupId);
    invariant(group, "Expected media group to exist when flushing");
    this.#groups.delete(mediaGroupId);
    const promise = this.#onFlush(group.entries);
    this.#floatingPromises.track(promise);
  }

  [Symbol.dispose](): void {
    this.#disposed = true;
    for (const group of this.#groups.values()) {
      clearTimeout(group.timer);
    }
    this.#groups.clear();
  }

  static create(
    floatingPromises: FloatingPromises,
    onFlush: (entries: readonly MediaGroupBuffer.Entry[]) => Promise<void>,
    delay = 1000,
  ): MediaGroupBuffer {
    return new MediaGroupBuffer(floatingPromises, onFlush, delay);
  }
}

export namespace MediaGroupBuffer {
  export type Part =
    | { readonly type: "text"; readonly text: string }
    | {
        readonly type: "file";
        readonly mime: string;
        readonly filename: string;
        readonly url: string;
      };

  export interface Entry {
    readonly chatId: number;
    readonly threadId: number | undefined;
    readonly messageId: number;
    readonly download: () => Promise<readonly Part[]>;
  }
}
