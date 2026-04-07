import { expect, test } from "vitest";
import { grammyBuildDraftId } from "~/lib/grammy-build-draft-id";

test("builds a deterministic draft id from a message id", () => {
  expect(grammyBuildDraftId("m1")).toBe(3_926_121_320_106_770);
  expect(grammyBuildDraftId("m1")).toBe(3_926_121_320_106_770);
});

test("returns a positive safe integer draft id", () => {
  const draftId = grammyBuildDraftId("message-123");

  expect(Number.isSafeInteger(draftId)).toBe(true);
  expect(draftId).toBeGreaterThan(0);
  expect(draftId).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
});

test("builds different draft ids for different message ids", () => {
  expect(grammyBuildDraftId("m1")).toBe(3_926_121_320_106_770);
  expect(grammyBuildDraftId("m2")).toBe(477_780_337_894_116);
});

test("supports empty message ids deterministically", () => {
  expect(grammyBuildDraftId("")).toBe(4_719_389_940_917_042);
});
