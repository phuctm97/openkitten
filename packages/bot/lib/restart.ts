import { logger } from "~/lib/logger";
import { OpencodeConfig } from "~/lib/opencode-config";
import { Shutdown } from "~/lib/shutdown";
import { TelegramConfig } from "~/lib/telegram-config";

const restartWindowLimit = 5;
const restartRetryWindowMs = 30_000;

class TooManyRestartError extends Error {
  constructor(restartWindowCount: number) {
    super(
      `OpenKitten stopped unexpectedly ${restartWindowCount} times within ${restartRetryWindowMs / 1000} seconds`,
    );
  }
}

function restartTrack(restartTimestamps: number[], now = Date.now()) {
  restartTimestamps.push(now);
  while (
    restartTimestamps[0] !== undefined &&
    now - restartTimestamps[0] > restartRetryWindowMs
  ) {
    restartTimestamps.shift();
  }
  return restartTimestamps.length;
}

function restartLog(restartWindowCount: number, ...restArgs: unknown[]) {
  const args: unknown[] = ["OpenKitten stopped unexpectedly, restarting…"];
  args.push(...restArgs);
  args.push({
    restartWindowCount,
    restartWindowLimit,
    restartWindowMs: restartRetryWindowMs,
  });
  logger.error(...args);
}

export async function restart(
  fn: (attempt: number) => Promise<unknown>,
): Promise<void> {
  const restartTimestamps: number[] = [];

  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await fn(attempt);
      if (result === Shutdown.symbol) return;
      const restartWindowCount = restartTrack(restartTimestamps);
      if (restartWindowCount >= restartWindowLimit) {
        throw new TooManyRestartError(restartWindowCount);
      }
      restartLog(restartWindowCount);
    } catch (error) {
      if (
        error instanceof TooManyRestartError ||
        error instanceof TelegramConfig.CancelledError ||
        error instanceof OpencodeConfig.CancelledError
      ) {
        throw error;
      }
      const restartWindowCount = restartTrack(restartTimestamps);
      if (restartWindowCount >= restartWindowLimit) {
        throw error;
      }
      restartLog(restartWindowCount, error);
    }
  }
}
