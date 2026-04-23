import { Logger } from "tslog";
import { isProduction } from "~/lib/is-production";
import { isTTY } from "~/lib/is-tty";

const logLevels = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
} as const;

type LogLevel = keyof typeof logLevels;

function getMinLevel(): number {
  const env = Bun.env.OPENKITTEN_LOG_LEVEL;
  if (env === undefined) return logLevels.silly;
  const level = logLevels[env as LogLevel];
  if (level === undefined)
    throw new Error(
      `Invalid OPENKITTEN_LOG_LEVEL "${env}", expected: ${Object.keys(logLevels).join(", ")}`,
    );
  return level;
}

export const logger = new Logger({
  type: isTTY ? "pretty" : "json",
  minLevel: getMinLevel(),
  hideLogPositionForProduction: isProduction,
});
