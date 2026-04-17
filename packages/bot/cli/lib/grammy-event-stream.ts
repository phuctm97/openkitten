import type { Bot } from "grammy";
import { logger } from "~/lib/logger";
import type { Shutdown } from "~/lib/shutdown";

export class GrammyEventStream implements AsyncDisposable {
  readonly #ended: Promise<void>;
  readonly #dispose: () => Promise<void>;

  private constructor(ended: Promise<void>, dispose: () => Promise<void>) {
    this.#ended = ended;
    this.#dispose = dispose;
  }

  get ended(): Promise<void> {
    return this.#ended;
  }

  async [Symbol.asyncDispose]() {
    await this.#dispose();
  }

  static async create(
    bot: Bot,
    shutdown: Shutdown,
  ): Promise<GrammyEventStream> {
    logger.debug("grammY event stream is connecting…");

    // Fatal: errors should never reach here — all event handlers will have
    // their own error boundaries.
    bot.catch(({ ctx, error }) => {
      logger.fatal("grammY event stream caught an error", error, {
        update: ctx.update,
      });
      shutdown.trigger();
    });

    const { resolve, promise: started } = Promise.withResolvers<void>();
    const polling = bot.start({ onStart: () => resolve() });

    // bot.start() rejects if polling fails before onStart fires.
    await Promise.race([started, polling]);

    // Only reject if polling stops on its own, not when we stop it.
    let disposed = false;
    const ended = polling
      .then(() => {
        if (disposed) return;
        throw new Error("grammY event stream ended unexpectedly");
      })
      .finally(() => {
        logger.info("grammY event stream is closed");
      });

    // ended rejects on unexpected end but may not be awaited immediately by
    // the consumer. Without this handler, ended's rejection would be unhandled.
    // So settled always resolves regardless of ended's outcome.
    const settled = ended.then(
      () => {},
      () => {},
    );

    logger.info("grammY event stream is connected");

    return new GrammyEventStream(ended, async () => {
      disposed = true;
      try {
        await bot.stop();
      } catch (error) {
        logger.fatal("Failed to stop polling updates from Telegram", error);
        shutdown.trigger();
      }
      // Resolve the started promise so it can be GC'd (onStart may never fire).
      resolve();
      await Promise.all([started, settled]);
    });
  }
}
