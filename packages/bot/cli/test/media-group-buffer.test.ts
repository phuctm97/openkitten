import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FloatingPromises } from "~/lib/floating-promises";
import { MediaGroupBuffer } from "~/lib/media-group-buffer";

function createMockFloatingPromises() {
  return { track: vi.fn() } as unknown as FloatingPromises;
}

function makeEntry(messageId: number): MediaGroupBuffer.Entry {
  return {
    chatId: 100,
    threadId: undefined,
    messageId,
    download: async () => [{ type: "text", text: `message ${messageId}` }],
  };
}

const DELAY = 500;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("single entry flushes after delay", () => {
  const fp = createMockFloatingPromises();
  const onFlush = vi.fn(async () => {});
  const buffer = MediaGroupBuffer.create(fp, onFlush, DELAY);

  const entry = makeEntry(1);
  buffer.add("group-1", entry);

  expect(onFlush).not.toHaveBeenCalled();

  vi.advanceTimersByTime(DELAY);

  expect(onFlush).toHaveBeenCalledOnce();
  expect(onFlush).toHaveBeenCalledWith([entry]);
});

test("multiple entries with same mediaGroupId flush once with all entries", () => {
  const fp = createMockFloatingPromises();
  const onFlush = vi.fn(async () => {});
  const buffer = MediaGroupBuffer.create(fp, onFlush, DELAY);

  const entry1 = makeEntry(1);
  const entry2 = makeEntry(2);
  const entry3 = makeEntry(3);

  buffer.add("group-1", entry1);
  buffer.add("group-1", entry2);
  buffer.add("group-1", entry3);

  vi.advanceTimersByTime(DELAY);

  expect(onFlush).toHaveBeenCalledOnce();
  expect(onFlush).toHaveBeenCalledWith([entry1, entry2, entry3]);
});

test("entries with different mediaGroupIds flush separately", () => {
  const fp = createMockFloatingPromises();
  const onFlush = vi.fn(async () => {});
  const buffer = MediaGroupBuffer.create(fp, onFlush, DELAY);

  const entryA = makeEntry(1);
  const entryB = makeEntry(2);

  buffer.add("group-a", entryA);
  buffer.add("group-b", entryB);

  vi.advanceTimersByTime(DELAY);

  expect(onFlush).toHaveBeenCalledTimes(2);
  expect(onFlush).toHaveBeenCalledWith([entryA]);
  expect(onFlush).toHaveBeenCalledWith([entryB]);
});

test("adding an entry resets the debounce timer", () => {
  const fp = createMockFloatingPromises();
  const onFlush = vi.fn(async () => {});
  const buffer = MediaGroupBuffer.create(fp, onFlush, DELAY);

  const entry1 = makeEntry(1);
  const entry2 = makeEntry(2);
  buffer.add("group-1", entry1);

  vi.advanceTimersByTime(DELAY - 1);
  expect(onFlush).not.toHaveBeenCalled();

  buffer.add("group-1", entry2);

  vi.advanceTimersByTime(DELAY - 1);
  expect(onFlush).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  expect(onFlush).toHaveBeenCalledOnce();
  expect(onFlush).toHaveBeenCalledWith([entry1, entry2]);
});

test("dispose clears pending timers so entries are never flushed", () => {
  const fp = createMockFloatingPromises();
  const onFlush = vi.fn(async () => {});
  const buffer = MediaGroupBuffer.create(fp, onFlush, DELAY);

  buffer.add("group-1", makeEntry(1));
  buffer.add("group-2", makeEntry(2));

  buffer[Symbol.dispose]();

  vi.advanceTimersByTime(DELAY);

  expect(onFlush).not.toHaveBeenCalled();
});

test("floatingPromises.track is called with the flush promise", () => {
  const fp = createMockFloatingPromises();
  const flushPromise = Promise.resolve();
  const onFlush = vi.fn(() => flushPromise);
  const buffer = MediaGroupBuffer.create(fp, onFlush, DELAY);

  buffer.add("group-1", makeEntry(1));

  vi.advanceTimersByTime(DELAY);

  expect(fp.track).toHaveBeenCalledOnce();
  expect(fp.track).toHaveBeenCalledWith(flushPromise);
});

test("add after dispose is silently ignored", () => {
  const fp = createMockFloatingPromises();
  const onFlush = vi.fn(async () => {});
  const buffer = MediaGroupBuffer.create(fp, onFlush, DELAY);

  buffer[Symbol.dispose]();
  buffer.add("group-1", makeEntry(1));

  vi.advanceTimersByTime(DELAY);

  expect(onFlush).not.toHaveBeenCalled();
});

test("re-adding the same mediaGroupId after flush creates a new group", () => {
  const fp = createMockFloatingPromises();
  const onFlush = vi.fn(async () => {});
  const buffer = MediaGroupBuffer.create(fp, onFlush, DELAY);

  const entry1 = makeEntry(1);
  buffer.add("group-1", entry1);
  vi.advanceTimersByTime(DELAY);
  expect(onFlush).toHaveBeenCalledOnce();
  expect(onFlush).toHaveBeenCalledWith([entry1]);

  const entry2 = makeEntry(2);
  buffer.add("group-1", entry2);
  vi.advanceTimersByTime(DELAY);
  expect(onFlush).toHaveBeenCalledTimes(2);
  expect(onFlush).toHaveBeenLastCalledWith([entry2]);
});

test("dispose on empty buffer does not throw", () => {
  const fp = createMockFloatingPromises();
  const onFlush = vi.fn(async () => {});
  const buffer = MediaGroupBuffer.create(fp, onFlush, DELAY);

  expect(() => buffer[Symbol.dispose]()).not.toThrow();
});

test("default delay is used when not specified", () => {
  const fp = createMockFloatingPromises();
  const onFlush = vi.fn(async () => {});
  const buffer = MediaGroupBuffer.create(fp, onFlush);

  buffer.add("group-1", makeEntry(1));

  vi.advanceTimersByTime(999);
  expect(onFlush).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  expect(onFlush).toHaveBeenCalledOnce();
});
