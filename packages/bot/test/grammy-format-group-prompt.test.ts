import { expect, test } from "vitest";
import { grammyFormatGroupPrompt } from "~/lib/grammy-format-group-prompt";
import type { GroupMessage } from "~/lib/group-message-buffer";

function msg(fromName: string, text: string, isBot = false): GroupMessage {
  return {
    fromName,
    fromId: isBot ? 0 : 1,
    text,
    messageId: 1,
    timestamp: Date.now(),
    isBot,
  };
}

test("formats mention trigger with context", () => {
  const result = grammyFormatGroupPrompt({
    senderName: "Charlie",
    text: "Can you explain?",
    trigger: "mention",
    recentContext: [
      msg("Alice", "Hey everyone"),
      msg("Bot", "I can help!", true),
    ],
    botName: "Bot",
  });
  expect(result).toBe(
    "[Group conversation]\nAlice: Hey everyone\nBot: I can help!\n\n[Charlie said to Bot]:\n\nCan you explain?",
  );
});

test("formats mention trigger without context", () => {
  const result = grammyFormatGroupPrompt({
    senderName: "Charlie",
    text: "Hello!",
    trigger: "mention",
    recentContext: [],
    botName: "Bot",
  });
  expect(result).toBe("[Charlie said to Bot]:\n\nHello!");
});

test("formats reply trigger with quoted text", () => {
  const result = grammyFormatGroupPrompt({
    senderName: "Charlie",
    text: "Can you elaborate?",
    trigger: "reply",
    quotedText: "I explained the API earlier",
    recentContext: [],
    botName: "Bot",
  });
  expect(result).toBe(
    '[Charlie replied to Bot\'s message: "I explained the API earlier"]\n\nCan you elaborate?',
  );
});

test("formats reply trigger with context and quoted text", () => {
  const result = grammyFormatGroupPrompt({
    senderName: "Charlie",
    text: "Tell me more",
    trigger: "reply",
    quotedText: "Original bot message",
    recentContext: [msg("Alice", "Hi"), msg("Bob", "What's up")],
    botName: "Bot",
  });
  expect(result).toContain("[Group conversation]");
  expect(result).toContain("Alice: Hi");
  expect(result).toContain("Bob: What's up");
  expect(result).toContain(
    '[Charlie replied to Bot\'s message: "Original bot message"]',
  );
  expect(result).toContain("Tell me more");
});

test("truncates long quoted text to 300 chars", () => {
  const longQuote = "A".repeat(400);
  const result = grammyFormatGroupPrompt({
    senderName: "Charlie",
    text: "Hi",
    trigger: "reply",
    quotedText: longQuote,
    recentContext: [],
    botName: "Bot",
  });
  expect(result).toContain(`${"A".repeat(300)}...`);
  expect(result).not.toContain("A".repeat(301));
});

test("truncates long context messages to 200 chars", () => {
  const longMsg = "B".repeat(300);
  const result = grammyFormatGroupPrompt({
    senderName: "Charlie",
    text: "Hi",
    trigger: "mention",
    recentContext: [msg("Alice", longMsg)],
    botName: "Bot",
  });
  expect(result).toContain(`${"B".repeat(200)}...`);
  expect(result).not.toContain("B".repeat(201));
});

test("bot messages in context use bot name", () => {
  const result = grammyFormatGroupPrompt({
    senderName: "Charlie",
    text: "Hello",
    trigger: "mention",
    recentContext: [msg("SomeBot", "I am the bot", true)],
    botName: "MyBot",
  });
  expect(result).toContain("MyBot: I am the bot");
  expect(result).not.toContain("SomeBot");
});

test("reply trigger without quoted text falls back to mention format", () => {
  const result = grammyFormatGroupPrompt({
    senderName: "Charlie",
    text: "Hi",
    trigger: "reply",
    quotedText: undefined,
    recentContext: [],
    botName: "Bot",
  });
  expect(result).toContain("[Charlie said to Bot]:");
});
