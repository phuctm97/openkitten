import { afterEach, beforeEach, expect, test, vi } from "vitest";

let originalLogLevel: string | undefined;

beforeEach(() => {
  originalLogLevel = Bun.env["OPENKITTEN_LOG_LEVEL"];
  vi.resetModules();
});

afterEach(() => {
  if (originalLogLevel === undefined) {
    delete Bun.env["OPENKITTEN_LOG_LEVEL"];
  } else {
    Bun.env["OPENKITTEN_LOG_LEVEL"] = originalLogLevel;
  }
});

test("defaults to silly level", async () => {
  delete Bun.env["OPENKITTEN_LOG_LEVEL"];
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.minLevel).toBe(0);
});

test("parses silly level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "silly";
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.minLevel).toBe(0);
});

test("parses trace level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "trace";
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.minLevel).toBe(1);
});

test("parses debug level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "debug";
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.minLevel).toBe(2);
});

test("parses info level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "info";
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.minLevel).toBe(3);
});

test("parses warn level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "warn";
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.minLevel).toBe(4);
});

test("parses error level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "error";
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.minLevel).toBe(5);
});

test("parses fatal level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "fatal";
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.minLevel).toBe(6);
});

test("hides log position in production", async () => {
  delete Bun.env["OPENKITTEN_LOG_LEVEL"];
  vi.doMock("~/lib/is-production", () => ({ isProduction: true }));
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.hideLogPositionForProduction).toBe(true);
});

test("shows log position outside production", async () => {
  delete Bun.env["OPENKITTEN_LOG_LEVEL"];
  vi.doMock("~/lib/is-production", () => ({ isProduction: false }));
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.hideLogPositionForProduction).toBe(false);
});

test("uses pretty type when TTY", async () => {
  delete Bun.env["OPENKITTEN_LOG_LEVEL"];
  vi.doMock("~/lib/is-tty", () => ({ isTTY: true }));
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.type).toBe("pretty");
});

test("uses json type when not TTY", async () => {
  delete Bun.env["OPENKITTEN_LOG_LEVEL"];
  vi.doMock("~/lib/is-tty", () => ({ isTTY: false }));
  const { logger } = await import("~/lib/logger");
  expect(logger.settings.type).toBe("json");
});

test("throws on invalid level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "invalid";
  await expect(import("~/lib/logger")).rejects.toThrow(
    'Invalid OPENKITTEN_LOG_LEVEL "invalid", expected: silly, trace, debug, info, warn, error, fatal',
  );
});
