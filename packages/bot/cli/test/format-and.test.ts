import { expect, test } from "vitest";
import { formatAnd } from "~/lib/format-and";

test("empty args", () => {
  expect(formatAnd()).toBe("");
});

test("single arg", () => {
  expect(formatAnd("a")).toBe("a");
});

test("two args", () => {
  expect(formatAnd("a", "b")).toBe("a and b");
});

test("three args", () => {
  expect(formatAnd("a", "b", "c")).toBe("a, b and c");
});

test("four args", () => {
  expect(formatAnd("a", "b", "c", "d")).toBe("a, b, c and d");
});
