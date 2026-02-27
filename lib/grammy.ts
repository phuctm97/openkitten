import type { Bot } from "grammy";
import { logger } from "~/lib/logger";
import type { Shutdown } from "~/lib/shutdown";

export class Grammy implements AsyncDisposable {
  readonly #stopped: Promise<void>;
  readonly #dispose: () => Promise<void>;

  private constructor(stopped: Promise<void>, dispose: () => Promise<void>) {
    this.#stopped = stopped;
    this.#dispose = dispose;
  }

  get stopped(): Promise<void> {
    return this.#stopped;
  }

  async [Symbol.asyncDispose]() {
    await this.#dispose();
  }

  static async create(shutdown: Shutdown, bot: Bot): Promise<Grammy> {
    // Fatal: errors should never reach here — all event handlers will have
    // their own error boundaries.
    bot.catch(({ ctx, error }) => {
      logger.fatal("grammY caught an unhandled error", error, {
        update: ctx.update,
      });
      shutdown.trigger();
    });

    const { resolve, promise: started } = Promise.withResolvers<void>();
    logger.debug("grammY is starting…");
    const polling = bot.start({ onStart: () => resolve() });

    // bot.start() rejects if polling fails before onStart fires.
    await Promise.race([started, polling]);

    // Only reject if polling stops on its own, not when we stop it.
    let disposed = false;
    const stopped = polling.then(() => {
      logger.info("grammY is stopped");
      if (disposed) return;
      throw new Error("grammY stopped unexpectedly");
    });

    // stopped rejects on unexpected stop but may not be awaited immediately by
    // the consumer. Without this handler, stopped's rejection would be unhandled.
    // So settled always resolves regardless of stopped's outcome.
    const settled = stopped.then(
      () => {},
      () => {},
    );

    logger.info("grammY is ready");

    return new Grammy(stopped, async () => {
      disposed = true;
      try {
        await bot.stop();
      } catch (error) {
        logger.fatal("grammY failed to stop", error);
        shutdown.trigger();
      }
      // Resolve the started promise so it can be GC'd (onStart may never fire).
      resolve();
      await Promise.all([started, settled]);
    });
  }
}
