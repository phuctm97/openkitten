import { expect, test, vi } from "vitest";
import { logger } from "~/lib/logger";
import { OpencodeConfig } from "~/lib/opencode-config";
import { restart } from "~/lib/restart";
import { Shutdown } from "~/lib/shutdown";
import { TelegramConfig } from "~/lib/telegram-config";

test("restarts until the callback returns the shutdown symbol", async () => {
  const calls: number[] = [];

  await restart(async (attempt) => {
    calls.push(attempt);
    return attempt > 1 ? Shutdown.symbol : undefined;
  });

  expect(calls).toEqual([1, 2]);
  expect(logger.error).toHaveBeenCalledWith(
    "OpenKitten stopped unexpectedly, restarting…",
    {
      restartWindowCount: 1,
      restartWindowLimit: 5,
      restartWindowMs: 30_000,
    },
  );
});

test("retries unexpected errors until the callback succeeds", async () => {
  let attempts = 0;

  await restart(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary");
    return Shutdown.symbol;
  });

  expect(logger.error).toHaveBeenCalledWith(
    "OpenKitten stopped unexpectedly, restarting…",
    expect.any(Error),
    {
      restartWindowCount: 1,
      restartWindowLimit: 5,
      restartWindowMs: 30_000,
    },
  );
});

test("does not retry Telegram config cancellation", async () => {
  const error = new TelegramConfig.CancelledError();

  await expect(
    restart(async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.fatal).not.toHaveBeenCalled();
});

test("does not retry OpenCode config cancellation", async () => {
  const error = new OpencodeConfig.CancelledError();

  await expect(
    restart(async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(logger.error).not.toHaveBeenCalled();
  expect(logger.fatal).not.toHaveBeenCalled();
});

test("gives up after repeated unexpected stops", async () => {
  await expect(restart(async () => undefined)).rejects.toThrow(
    "OpenKitten stopped unexpectedly 5 times within 30 seconds",
  );

  expect(logger.error).toHaveBeenCalledTimes(4);
  expect(logger.fatal).not.toHaveBeenCalled();
});

test("gives up with the original error after repeated crashes", async () => {
  const error = new Error("persistent");

  await expect(
    restart(async () => {
      throw error;
    }),
  ).rejects.toBe(error);

  expect(logger.error).toHaveBeenCalledTimes(4);
  expect(logger.fatal).not.toHaveBeenCalled();
});

test("forgets old retries once they fall outside the retry window", async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(0);
    let attempts = 0;

    await restart(async () => {
      attempts += 1;
      if (attempts === 2) vi.setSystemTime(30_001);
      if (attempts === 3) return Shutdown.symbol;
      return undefined;
    });

    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      "OpenKitten stopped unexpectedly, restarting…",
      {
        restartWindowCount: 1,
        restartWindowLimit: 5,
        restartWindowMs: 30_000,
      },
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      "OpenKitten stopped unexpectedly, restarting…",
      {
        restartWindowCount: 1,
        restartWindowLimit: 5,
        restartWindowMs: 30_000,
      },
    );
  } finally {
    vi.useRealTimers();
  }
});
