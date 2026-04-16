import { expect, test } from "vitest";
import { grammyCheckGroupTrigger } from "~/lib/grammy-check-group-trigger";

const botUsername = "test_bot";
const botId = 100;

function textCtx(
  text: string,
  entities: { type: string; offset: number; length: number }[] = [],
  replyTo?: { from?: { id: number }; text?: string; caption?: string },
) {
  return {
    message: {
      text,
      entities,
      caption_entities: undefined,
      reply_to_message: replyTo,
    },
  } as never;
}

function captionCtx(
  caption: string,
  captionEntities: { type: string; offset: number; length: number }[] = [],
  replyTo?: { from?: { id: number }; text?: string },
) {
  return {
    message: {
      caption,
      caption_entities: captionEntities,
      entities: undefined,
      reply_to_message: replyTo,
    },
  } as never;
}

// --- Reply triggers ---

test("reply to bot message returns reply trigger", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("hello", [], { from: { id: botId }, text: "I said something" }),
    botUsername,
    botId,
  );
  expect(result).toEqual({
    type: "reply",
    text: "hello",
    quotedText: "I said something",
  });
});

test("reply to bot message with mention strips mention", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("@test_bot explain more", [], {
      from: { id: botId },
      text: "Original",
    }),
    botUsername,
    botId,
  );
  expect(result).toEqual({
    type: "reply",
    text: "explain more",
    quotedText: "Original",
  });
});

test("reply to bot with no text returns Hey", () => {
  const ctx = {
    message: {
      reply_to_message: { from: { id: botId }, text: "Bot said this" },
    },
  } as never;
  const result = grammyCheckGroupTrigger(ctx, botUsername, botId);
  expect(result).toEqual({
    type: "reply",
    text: "Hey",
    quotedText: "Bot said this",
  });
});

test("reply to bot message truncates long quoted text", () => {
  const longText = "A".repeat(400);
  const result = grammyCheckGroupTrigger(
    textCtx("hi", [], { from: { id: botId }, text: longText }),
    botUsername,
    botId,
  );
  expect(result.type).toBe("reply");
  if (result.type === "reply") {
    expect(result.quotedText).toBe(`${"A".repeat(300)}...`);
  }
});

test("reply to bot with caption-only message extracts caption as quoted text", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("hello", [], {
      from: { id: botId },
      caption: "Bot caption",
    }),
    botUsername,
    botId,
  );
  expect(result.type).toBe("reply");
  if (result.type === "reply") {
    expect(result.quotedText).toBe("Bot caption");
  }
});

test("reply to non-bot user returns context", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("hello", [], { from: { id: 999 }, text: "Someone else" }),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "context" });
});

// --- Mention triggers ---

test("@botname at beginning triggers mention", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("@test_bot hello", [{ type: "mention", offset: 0, length: 9 }]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "mention", text: "hello" });
});

test("@botname at end triggers mention", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("hello @test_bot", [{ type: "mention", offset: 6, length: 9 }]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "mention", text: "hello" });
});

test("@botname in middle triggers mention", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("hello @test_bot world", [
      { type: "mention", offset: 6, length: 9 },
    ]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "mention", text: "hello  world" });
});

test("@botname with no other text returns Hey", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("@test_bot", [{ type: "mention", offset: 0, length: 9 }]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "mention", text: "Hey" });
});

test("@BOTNAME case insensitive triggers mention", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("@TEST_BOT hi", [{ type: "mention", offset: 0, length: 9 }]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "mention", text: "hi" });
});

test("mention of different bot is context", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("@other_bot hi", [{ type: "mention", offset: 0, length: 10 }]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "context" });
});

test("mention in caption triggers mention", () => {
  const result = grammyCheckGroupTrigger(
    captionCtx("@test_bot check this", [
      { type: "mention", offset: 0, length: 9 },
    ]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "mention", text: "check this" });
});

// --- Reply takes priority over mention ---

test("reply to bot with mention returns reply trigger", () => {
  const result = grammyCheckGroupTrigger(
    textCtx(
      "@test_bot explain more",
      [{ type: "mention", offset: 0, length: 9 }],
      { from: { id: botId }, text: "Original" },
    ),
    botUsername,
    botId,
  );
  expect(result.type).toBe("reply");
});

// --- Context ---

test("plain message returns context", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("hello everyone"),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "context" });
});

test("no message returns context", () => {
  const ctx = { message: undefined } as never;
  const result = grammyCheckGroupTrigger(ctx, botUsername, botId);
  expect(result).toEqual({ type: "context" });
});

test("bot_command entity is context (handled by command router)", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("/start", [{ type: "bot_command", offset: 0, length: 6 }]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "context" });
});

test("reply to message with no from returns context", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("hello", [], { text: "Something" }),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "context" });
});

test("reply to bot with caption in message extracts caption", () => {
  const ctx = {
    message: {
      caption: "@test_bot look",
      caption_entities: [{ type: "mention", offset: 0, length: 9 }],
      entities: undefined,
      reply_to_message: { from: { id: botId }, text: "Bot said" },
    },
  } as never;
  const result = grammyCheckGroupTrigger(ctx, botUsername, botId);
  expect(result.type).toBe("reply");
  if (result.type === "reply") {
    expect(result.text).toBe("look");
  }
});

// --- /command@botname triggers ---

test("/command@botname triggers as mention", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("/weather@test_bot Tokyo", [
      { type: "bot_command", offset: 0, length: 21 },
    ]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "mention", text: "/weather Tokyo" });
});

test("/command@botname with no args triggers as mention", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("/weather@test_bot", [
      { type: "bot_command", offset: 0, length: 17 },
    ]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "mention", text: "/weather" });
});

test("/command@otherbot is context", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("/weather@other_bot Tokyo", [
      { type: "bot_command", offset: 0, length: 22 },
    ]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "context" });
});

test("/command without @botname is context", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("/weather Tokyo", [{ type: "bot_command", offset: 0, length: 8 }]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "context" });
});

test("reply to bot with caption message (no text) extracts caption as text", () => {
  const ctx = {
    message: {
      caption: "look at this",
      caption_entities: [],
      entities: undefined,
      reply_to_message: { from: { id: botId }, text: "Bot response" },
    },
  } as never;
  const result = grammyCheckGroupTrigger(ctx, botUsername, botId);
  expect(result.type).toBe("reply");
  if (result.type === "reply") {
    expect(result.text).toBe("look at this");
  }
});

test("mention with reply to non-bot message includes quoted text", () => {
  const result = grammyCheckGroupTrigger(
    textCtx(
      "@test_bot explain this",
      [{ type: "mention", offset: 0, length: 9 }],
      { from: { id: 999 }, text: "Some user message" },
    ),
    botUsername,
    botId,
  );
  expect(result).toEqual({
    type: "mention",
    text: "explain this",
    quotedText: "Some user message",
  });
});

test("/command@botname with reply includes quoted text", () => {
  const result = grammyCheckGroupTrigger(
    textCtx(
      "/weather@test_bot Tokyo",
      [{ type: "bot_command", offset: 0, length: 21 }],
      { from: { id: 999 }, text: "Check the weather" },
    ),
    botUsername,
    botId,
  );
  expect(result).toEqual({
    type: "mention",
    text: "/weather Tokyo",
    quotedText: "Check the weather",
  });
});

test("reply to bot with text only mention returns Hey", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("@test_bot", [], { from: { id: botId }, text: "Original" }),
    botUsername,
    botId,
  );
  expect(result.type).toBe("reply");
  if (result.type === "reply") {
    expect(result.text).toBe("Hey");
  }
});

test("reply to bot with caption only mention returns Hey", () => {
  const ctx = {
    message: {
      caption: "@test_bot",
      caption_entities: [],
      entities: undefined,
      reply_to_message: { from: { id: botId }, text: "Original" },
    },
  } as never;
  const result = grammyCheckGroupTrigger(ctx, botUsername, botId);
  expect(result.type).toBe("reply");
  if (result.type === "reply") {
    expect(result.text).toBe("Hey");
  }
});

test("extractQuotedText returns empty string when reply has no text or caption", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("hello", [], { from: { id: botId } }),
    botUsername,
    botId,
  );
  expect(result.type).toBe("reply");
  if (result.type === "reply") {
    expect(result.quotedText).toBe("");
  }
});

test("/command@botname with only mention text returns Hey", () => {
  const result = grammyCheckGroupTrigger(
    textCtx("@test_bot", [{ type: "bot_command", offset: 0, length: 9 }]),
    botUsername,
    botId,
  );
  expect(result).toEqual({ type: "mention", text: "Hey" });
});
