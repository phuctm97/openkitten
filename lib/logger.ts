import { Logger } from "tslog";
import { defaultLoggerSettings } from "~/lib/default-logger-settings";

export const logger = new Logger({
  ...defaultLoggerSettings,
  hideLogPositionForProduction: Bun.env.NODE_ENV === "production",
});
