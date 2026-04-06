import { logger } from "~/lib/logger";
import { OpencodeConfig } from "~/lib/opencode-config";
import { Shutdown } from "~/lib/shutdown";
import { TelegramConfig } from "~/lib/telegram-config";

const restartWindowLimit = 5;
const restartWindowDuration = 30_000;

class TooManyRestartError extends Error {
  constructor(restartWindowCount: number) {
    super(
      `OpenKitten server exited unexpectedly ${restartWindowCount} times within ${restartWindowDuration / 1000} seconds`,
    );
  }
}

function restartTrack(restartTimestamps: number[]) {
  const now = Date.now();
  restartTimestamps.push(now);
  while (
    restartTimestamps[0] !== undefined &&
    now - restartTimestamps[0] > restartWindowDuration
  ) {
    restartTimestamps.shift();
  }
  return restartTimestamps.length;
}

function restartLog(restartWindowCount: number, ...restartLogArgs: unknown[]) {
  const args: unknown[] = [
    "OpenKitten server exited unexpectedly, restarting…",
  ];
  args.push(...restartLogArgs);
  args.push({
    restartWindowCount,
    restartWindowLimit,
    restartWindowDuration,
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
      if (result === Shutdown.symbol) break;
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
