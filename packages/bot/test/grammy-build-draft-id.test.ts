import { expect, test } from "vitest";
import { grammyBuildDraftId } from "~/lib/grammy-build-draft-id";

test("builds a deterministic draft id from a message id", () => {
  expect(grammyBuildDraftId("m1")).toBe(8_693_816_509_193_415);
  expect(grammyBuildDraftId("m1")).toBe(8_693_816_509_193_415);
});

test("returns a positive safe integer draft id", () => {
  const draftId = grammyBuildDraftId("message-123");

  expect(Number.isSafeInteger(draftId)).toBe(true);
  expect(draftId).toBeGreaterThan(0);
  expect(draftId).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
});

test("builds different draft ids for different message ids", () => {
  expect(grammyBuildDraftId("m1")).toBe(8_693_816_509_193_415);
  expect(grammyBuildDraftId("m2")).toBe(2_700_003_061_566_943);
});

test("supports empty message ids deterministically", () => {
  expect(grammyBuildDraftId("")).toBe(2_068_769_241_846_288);
});
