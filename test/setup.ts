import { beforeEach, vi } from "vitest";
import { logger } from "~/lib/logger";
import { resetLoggerSettings } from "~/lib/reset-logger-settings";

beforeEach(() => {
  vi.restoreAllMocks();
  resetLoggerSettings();
  vi.spyOn(logger, "silly").mockReturnValue(undefined);
  vi.spyOn(logger, "info").mockReturnValue(undefined);
  vi.spyOn(logger, "debug").mockReturnValue(undefined);
  vi.spyOn(logger, "trace").mockReturnValue(undefined);
  vi.spyOn(logger, "warn").mockReturnValue(undefined);
  vi.spyOn(logger, "error").mockReturnValue(undefined);
  vi.spyOn(logger, "fatal").mockReturnValue(undefined);
});
