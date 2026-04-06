import { logger } from "~/lib/logger";
import { OpencodeConfig } from "~/lib/opencode-config";
import { Shutdown } from "~/lib/shutdown";
import { TelegramConfig } from "~/lib/telegram-config";

const restartRetryLimit = 5;
const restartRetryWindowMs = 60_000;

class TooManyRestartError extends Error {
  constructor(retryCount: number) {
    super(
      `OpenKitten stopped unexpectedly ${retryCount} times within ${restartRetryWindowMs / 1000} seconds`,
    );
    this.name = "TooManyRestartError";
  }
}

function restartTrackRetry(retryTimestamps: number[], now = Date.now()) {
  retryTimestamps.push(now);
  while (
    retryTimestamps[0] !== undefined &&
    now - retryTimestamps[0] > restartRetryWindowMs
  ) {
    retryTimestamps.shift();
  }
  return retryTimestamps.length;
}

function restartLogMeta(retryCount: number) {
  return {
    restartCount: retryCount,
    restartLimit: restartRetryLimit,
    restartWindowMs: restartRetryWindowMs,
  };
}

export async function restart(
  fn: (attempt: number) => Promise<unknown>,
): Promise<void> {
  const retryTimestamps: number[] = [];

  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await fn(attempt);
      if (result === Shutdown.symbol) return;
      const retryCount = restartTrackRetry(retryTimestamps);
      if (retryCount >= restartRetryLimit) {
        const error = new TooManyRestartError(retryCount);
        logger.fatal(
          "OpenKitten stopped unexpectedly too many times, giving up…",
          error,
          restartLogMeta(retryCount),
        );
        throw error;
      }
      logger.warn(
        "OpenKitten stopped unexpectedly, restarting…",
        restartLogMeta(retryCount),
      );
    } catch (error) {
      if (error instanceof TooManyRestartError) throw error;
      if (
        error instanceof TelegramConfig.CancelledError ||
        error instanceof OpencodeConfig.CancelledError
      ) {
        throw error;
      }
      const retryCount = restartTrackRetry(retryTimestamps);
      if (retryCount >= restartRetryLimit) {
        logger.fatal(
          "OpenKitten crashed unexpectedly too many times, giving up…",
          error,
          restartLogMeta(retryCount),
        );
        throw error;
      }
      logger.error(
        "OpenKitten crashed unexpectedly, restarting…",
        error,
        restartLogMeta(retryCount),
      );
    }
  }
}
