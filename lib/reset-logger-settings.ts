import { defaultLoggerSettings } from "~/lib/default-logger-settings";
import { logger } from "~/lib/logger";

export function resetLoggerSettings() {
  Object.assign(logger.settings, defaultLoggerSettings);
}
