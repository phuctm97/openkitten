import { expect, test } from "vitest";
import {
  type GroupMessage,
  GroupMessageBuffer,
} from "~/lib/group-message-buffer";

function msg(text: string, fromId = 1, isBot = false): GroupMessage {
  return {
    fromName: `User${fromId}`,
    fromId,
    text,
    messageId: Math.floor(Math.random() * 100000),
    timestamp: Date.now(),
    isBot,
  };
}

const locationA = { chatId: 100, threadId: undefined };
const locationB = { chatId: 200, threadId: 5 };

test("adds and retrieves messages", () => {
  using buffer = GroupMessageBuffer.create();
  buffer.add(locationA, msg("hello"));
  buffer.add(locationA, msg("world"));
  const recent = buffer.recent(locationA);
  expect(recent).toHaveLength(2);
  expect(recent[0]?.text).toBe("hello");
  expect(recent[1]?.text).toBe("world");
});

test("returns empty array for unknown location", () => {
  using buffer = GroupMessageBuffer.create();
  expect(buffer.recent(locationA)).toEqual([]);
});

test("evicts oldest messages when over capacity", () => {
  using buffer = GroupMessageBuffer.create({ maxPerChat: 3 });
  buffer.add(locationA, msg("a"));
  buffer.add(locationA, msg("b"));
  buffer.add(locationA, msg("c"));
  buffer.add(locationA, msg("d"));
  const recent = buffer.recent(locationA);
  expect(recent).toHaveLength(3);
  expect(recent[0]?.text).toBe("b");
  expect(recent[2]?.text).toBe("d");
});

test("recent with limit returns last N messages", () => {
  using buffer = GroupMessageBuffer.create();
  buffer.add(locationA, msg("a"));
  buffer.add(locationA, msg("b"));
  buffer.add(locationA, msg("c"));
  const recent = buffer.recent(locationA, 2);
  expect(recent).toHaveLength(2);
  expect(recent[0]?.text).toBe("b");
  expect(recent[1]?.text).toBe("c");
});

test("recent with limit larger than buffer returns all", () => {
  using buffer = GroupMessageBuffer.create();
  buffer.add(locationA, msg("a"));
  const recent = buffer.recent(locationA, 10);
  expect(recent).toHaveLength(1);
});

test("separate buffers per location", () => {
  using buffer = GroupMessageBuffer.create();
  buffer.add(locationA, msg("in A"));
  buffer.add(locationB, msg("in B"));
  expect(buffer.recent(locationA)).toHaveLength(1);
  expect(buffer.recent(locationA)[0]?.text).toBe("in A");
  expect(buffer.recent(locationB)).toHaveLength(1);
  expect(buffer.recent(locationB)[0]?.text).toBe("in B");
});

test("clear removes messages for a location", () => {
  using buffer = GroupMessageBuffer.create();
  buffer.add(locationA, msg("hello"));
  buffer.add(locationB, msg("world"));
  buffer.clear(locationA);
  expect(buffer.recent(locationA)).toEqual([]);
  expect(buffer.recent(locationB)).toHaveLength(1);
});

test("dispose clears all buffers", () => {
  const buffer = GroupMessageBuffer.create();
  buffer.add(locationA, msg("hello"));
  buffer.add(locationB, msg("world"));
  buffer[Symbol.dispose]();
  expect(buffer.recent(locationA)).toEqual([]);
  expect(buffer.recent(locationB)).toEqual([]);
});

test("recent returns a copy, not the internal buffer", () => {
  using buffer = GroupMessageBuffer.create();
  buffer.add(locationA, msg("hello"));
  const recent = buffer.recent(locationA);
  buffer.add(locationA, msg("world"));
  expect(recent).toHaveLength(1);
});

test("default capacity is 50", () => {
  using buffer = GroupMessageBuffer.create();
  for (let i = 0; i < 60; i++) {
    buffer.add(locationA, msg(`msg-${i}`));
  }
  const recent = buffer.recent(locationA);
  expect(recent).toHaveLength(50);
  expect(recent[0]?.text).toBe("msg-10");
  expect(recent[49]?.text).toBe("msg-59");
});

test("threadId 0 and undefined are treated as same location", () => {
  using buffer = GroupMessageBuffer.create();
  buffer.add({ chatId: 100, threadId: undefined }, msg("a"));
  buffer.add({ chatId: 100, threadId: 0 as never }, msg("b"));
  // Both should go to the same buffer since undefined maps to "100:0"
  // and threadId 0 also maps to "100:0"
  expect(buffer.recent({ chatId: 100, threadId: undefined })).toHaveLength(2);
});
