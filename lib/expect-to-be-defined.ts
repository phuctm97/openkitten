import { expect } from "bun:test";

export function expectToBeDefined<T>(
  value: T,
): asserts value is NonNullable<T> {
  expect(value).toBeDefined();
}
