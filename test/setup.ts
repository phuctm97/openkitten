import { beforeEach, vi } from "vitest";
import { defaultLoggerSettings } from "~/lib/default-logger-settings";
import { logger } from "~/lib/logger";

beforeEach(() => {
  vi.restoreAllMocks();
  Object.assign(logger.settings, defaultLoggerSettings);
  vi.spyOn(logger, "silly").mockReturnValue(undefined);
  vi.spyOn(logger, "info").mockReturnValue(undefined);
  vi.spyOn(logger, "debug").mockReturnValue(undefined);
  vi.spyOn(logger, "trace").mockReturnValue(undefined);
  vi.spyOn(logger, "warn").mockReturnValue(undefined);
  vi.spyOn(logger, "error").mockReturnValue(undefined);
  vi.spyOn(logger, "fatal").mockReturnValue(undefined);
});
