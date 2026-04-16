import { afterEach, beforeEach, expect, test, vi } from "vitest";

const originalStdinIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: originalStdinIsTTY,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: originalStdoutIsTTY,
    configurable: true,
  });
});

test("true when both stdin and stdout are TTY", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });
  const { isTTY } = await import("~/lib/is-tty");
  expect(isTTY).toBe(true);
});

test("false when stdin is not TTY", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: undefined,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });
  const { isTTY } = await import("~/lib/is-tty");
  expect(isTTY).toBe(false);
});

test("false when stdout is not TTY", async () => {
  Object.defineProperty(process.stdin, "isTTY", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: undefined,
    configurable: true,
  });
  const { isTTY } = await import("~/lib/is-tty");
  expect(isTTY).toBe(false);
});
