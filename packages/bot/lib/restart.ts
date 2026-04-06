import { logger } from "~/lib/logger";
import { OpencodeConfig } from "~/lib/opencode-config";
import { Shutdown } from "~/lib/shutdown";
import { TelegramConfig } from "~/lib/telegram-config";

const restartRetryLimit = 5;
const restartRetryWindowMs = 60_000;

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

function restartCreateResultError(retryCount: number) {
  return new Error(
    `OpenKitten stopped unexpectedly ${retryCount} times within ${restartRetryWindowMs / 1000} seconds`,
  );
}

function restartGetLogMeta(retryCount: number) {
  return {
    restartCount: retryCount,
    restartLimit: restartRetryLimit,
    restartWindowMs: restartRetryWindowMs,
  };
}

export async function restart(
  fn: (context: restart.Context) => Promise<unknown>,
): Promise<void> {
  const retryTimestamps: number[] = [];

  for (let attempt = 1; ; attempt += 1) {
    const context: restart.Context = {
      restarted: attempt > 1,
    };
    try {
      const result = await fn(context);
      if (result === Shutdown.symbol) return;
      const retryCount = restartTrackRetry(retryTimestamps);
      if (retryCount >= restartRetryLimit) {
        const error = restartCreateResultError(retryCount);
        logger.fatal(
          "OpenKitten stopped unexpectedly too many times, giving up",
          error,
          restartGetLogMeta(retryCount),
        );
        throw error;
      }
      logger.warn(
        "OpenKitten stopped unexpectedly, restarting",
        restartGetLogMeta(retryCount),
      );
    } catch (error) {
      if (
        error instanceof TelegramConfig.CancelledError ||
        error instanceof OpencodeConfig.CancelledError
      ) {
        throw error;
      }
      const retryCount = restartTrackRetry(retryTimestamps);
      if (retryCount >= restartRetryLimit) {
        logger.fatal(
          "OpenKitten failed unexpectedly too many times, giving up",
          error,
          restartGetLogMeta(retryCount),
        );
        throw error;
      }
      logger.error(
        "OpenKitten failed unexpectedly, restarting",
        error,
        restartGetLogMeta(retryCount),
      );
    }
  }
}

export namespace restart {
  export interface Context {
    readonly restarted: boolean;
  }
}
