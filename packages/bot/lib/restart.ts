import { logger } from "~/lib/logger";
import { OpencodeConfig } from "~/lib/opencode-config";
import { Shutdown } from "~/lib/shutdown";
import { TelegramConfig } from "~/lib/telegram-config";

const restartRetryLimit = 5;
const restartRetryWindowMs = 60_000;

class TooManyRetryError extends Error {
  constructor(retryCount: number) {
    super(
      `OpenKitten stopped unexpectedly ${retryCount} times within ${restartRetryWindowMs / 1000} seconds`,
    );
  }
}

function restartTrack(retryTimestamps: number[], now = Date.now()) {
  retryTimestamps.push(now);
  while (
    retryTimestamps[0] !== undefined &&
    now - retryTimestamps[0] > restartRetryWindowMs
  ) {
    retryTimestamps.shift();
  }
  return retryTimestamps.length;
}

function restartLog(retryCount: number, ...restArgs: unknown[]) {
  const args: unknown[] = ["OpenKitten stopped unexpectedly, restarting…"];
  args.push(...restArgs);
  args.push({
    restartCount: retryCount,
    restartLimit: restartRetryLimit,
    restartWindowMs: restartRetryWindowMs,
  });
  logger.error(...args);
}

export async function restart(
  fn: (attempt: number) => Promise<unknown>,
): Promise<void> {
  const retryTimestamps: number[] = [];

  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await fn(attempt);
      if (result === Shutdown.symbol) return;
      const retryCount = restartTrack(retryTimestamps);
      if (retryCount >= restartRetryLimit) {
        throw new TooManyRetryError(retryCount);
      }
      restartLog(retryCount);
    } catch (error) {
      if (
        error instanceof TooManyRetryError ||
        error instanceof TelegramConfig.CancelledError ||
        error instanceof OpencodeConfig.CancelledError
      ) {
        throw error;
      }
      const retryCount = restartTrack(retryTimestamps);
      if (retryCount >= restartRetryLimit) {
        throw error;
      }
      restartLog(retryCount, error);
    }
  }
}
