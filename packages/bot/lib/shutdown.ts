import { logger } from "~/lib/logger";

const shutdownEvents = [
  "beforeExit",
  "disconnect",
  "SIGINT",
  "SIGTERM",
  "SIGHUP",
  "SIGQUIT",
  "SIGBREAK",
  "SIGUSR2",
] as const;

const shutdownSymbol = Symbol("shutdown");

export class Shutdown implements Disposable {
  readonly #handlers = new Map(
    shutdownEvents.map((event) => [event, () => this.#onSignal(event)]),
  );
  readonly #controller = new AbortController();
  readonly #signaled = Promise.withResolvers<
    typeof shutdownSymbol | undefined
  >();
  readonly #onSignal = (event?: string) => {
    if (this.#controller.signal.aborted) return;
    this.#controller.abort();
    logger.info("Shutdown is triggered", { event });
    for (const [name, handler] of this.#handlers) {
      process.off(name, handler);
    }
    process.off("message", this.#onMessage);
    this.#signaled.resolve(event ? shutdownSymbol : undefined);
  };
  readonly #onMessage = (message: unknown) => {
    if (message === "shutdown") this.#onSignal("shutdown");
  };

  private constructor() {
    for (const [event, handler] of this.#handlers) {
      process.once(event, handler);
    }
    process.on("message", this.#onMessage);
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  get signaled(): Promise<typeof Shutdown.symbol | undefined> {
    return this.#signaled.promise;
  }

  trigger(event?: string) {
    this.#onSignal(event);
  }

  [Symbol.dispose]() {
    this.#onSignal();
  }

  static readonly events = shutdownEvents;

  static readonly symbol = shutdownSymbol;

  static create(): Shutdown {
    return new Shutdown();
  }
}
