import { GrammyError } from "grammy";
import { expect, test } from "vitest";
import { grammyCheckGoneError } from "~/lib/grammy-check-gone-error";

function createGrammyError(errorCode: number, description: string) {
  return new GrammyError(
    `Call to 'sendChatAction' failed! (${errorCode}: ${description})`,
    { ok: false, error_code: errorCode, description },
    "sendChatAction",
    {},
  );
}

test("returns true for 403 forbidden", () => {
  expect(
    grammyCheckGoneError(
      createGrammyError(403, "Forbidden: bot was blocked by the user"),
    ),
  ).toBe(true);
});

test("returns true for 403 bot kicked", () => {
  expect(
    grammyCheckGoneError(
      createGrammyError(403, "Forbidden: bot was kicked from the group chat"),
    ),
  ).toBe(true);
});

test("returns true for 403 user deactivated", () => {
  expect(
    grammyCheckGoneError(
      createGrammyError(403, "Forbidden: user is deactivated"),
    ),
  ).toBe(true);
});

test("returns true for 400 chat not found", () => {
  expect(
    grammyCheckGoneError(createGrammyError(400, "Bad Request: chat not found")),
  ).toBe(true);
});

test("returns true for 400 invalid chat id", () => {
  expect(
    grammyCheckGoneError(
      createGrammyError(400, "Bad Request: CHAT_ID_INVALID"),
    ),
  ).toBe(true);
});

test("returns true for 400 invalid thread", () => {
  expect(
    grammyCheckGoneError(
      createGrammyError(400, "Bad Request: message_thread_not_found"),
    ),
  ).toBe(true);
});

test("returns false for 400 unrelated bad request", () => {
  expect(
    grammyCheckGoneError(
      createGrammyError(400, "Bad Request: message text is empty"),
    ),
  ).toBe(false);
});

test("returns false for 429 rate limit", () => {
  expect(
    grammyCheckGoneError(
      createGrammyError(429, "Too Many Requests: retry after 30"),
    ),
  ).toBe(false);
});

test("returns false for 500 server error", () => {
  expect(
    grammyCheckGoneError(createGrammyError(500, "Internal Server Error")),
  ).toBe(false);
});

test("returns false for non-grammy error", () => {
  expect(grammyCheckGoneError(new Error("network error"))).toBe(false);
});

test("returns false for non-error value", () => {
  expect(grammyCheckGoneError("string error")).toBe(false);
});
