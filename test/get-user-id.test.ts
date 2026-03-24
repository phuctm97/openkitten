import { afterEach, expect, test } from "vitest";
import { getUserId } from "~/lib/get-user-id";

const originalGetuid = process.getuid;

afterEach(() => {
  Object.defineProperty(process, "getuid", { value: originalGetuid });
});

test("returns uid from process.getuid", () => {
  Object.defineProperty(process, "getuid", {
    value: () => 501,
    writable: true,
  });
  expect(getUserId()).toBe(501);
});

test("throws when process.getuid is unavailable", () => {
  Object.defineProperty(process, "getuid", {
    value: undefined,
    writable: true,
  });
  expect(() => getUserId()).toThrow("process.getuid is not available");
});
