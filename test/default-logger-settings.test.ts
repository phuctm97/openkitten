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
  const { defaultLoggerSettings } = await import(
    "~/lib/default-logger-settings"
  );
  expect(defaultLoggerSettings.minLevel).toBe(0);
});

test("parses silly level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "silly";
  const { defaultLoggerSettings } = await import(
    "~/lib/default-logger-settings"
  );
  expect(defaultLoggerSettings.minLevel).toBe(0);
});

test("parses trace level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "trace";
  const { defaultLoggerSettings } = await import(
    "~/lib/default-logger-settings"
  );
  expect(defaultLoggerSettings.minLevel).toBe(1);
});

test("parses debug level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "debug";
  const { defaultLoggerSettings } = await import(
    "~/lib/default-logger-settings"
  );
  expect(defaultLoggerSettings.minLevel).toBe(2);
});

test("parses info level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "info";
  const { defaultLoggerSettings } = await import(
    "~/lib/default-logger-settings"
  );
  expect(defaultLoggerSettings.minLevel).toBe(3);
});

test("parses warn level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "warn";
  const { defaultLoggerSettings } = await import(
    "~/lib/default-logger-settings"
  );
  expect(defaultLoggerSettings.minLevel).toBe(4);
});

test("parses error level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "error";
  const { defaultLoggerSettings } = await import(
    "~/lib/default-logger-settings"
  );
  expect(defaultLoggerSettings.minLevel).toBe(5);
});

test("parses fatal level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "fatal";
  const { defaultLoggerSettings } = await import(
    "~/lib/default-logger-settings"
  );
  expect(defaultLoggerSettings.minLevel).toBe(6);
});

test("throws on invalid level", async () => {
  Bun.env["OPENKITTEN_LOG_LEVEL"] = "invalid";
  await expect(import("~/lib/default-logger-settings")).rejects.toThrow(
    'Invalid OPENKITTEN_LOG_LEVEL "invalid", expected: silly, trace, debug, info, warn, error, fatal',
  );
});
