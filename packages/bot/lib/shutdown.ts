import { logger } from "~/lib/logger";

export class Shutdown implements Disposable {
  readonly #controller = new AbortController();
  readonly #signaled: Promise<typeof Shutdown.symbol | undefined>;
  readonly #signalHandlers: ReadonlyMap<
    (typeof Shutdown.events)[number],
    () => void
  >;
  readonly #onSignal: (event?: string) => void;
  readonly #onMessage: (message: unknown) => void;

  private constructor() {
    const { resolve, promise: signaled } = Promise.withResolvers<
      typeof Shutdown.symbol | undefined
    >();
    this.#signaled = signaled;

    this.#onSignal = (event?: string) => {
      if (this.#controller.signal.aborted) return;
      this.#controller.abort();
      logger.info("Shutdown is triggered", { event });
      for (const [name, handler] of this.#signalHandlers) {
        process.off(name, handler);
      }
      process.off("message", this.#onMessage);
      resolve(event ? Shutdown.symbol : undefined);
    };

    this.#signalHandlers = new Map(
      Shutdown.events.map((event) => [event, () => this.#onSignal(event)]),
    );

    this.#onMessage = (message: unknown) => {
      if (message === "shutdown") this.#onSignal("shutdown");
    };

    for (const [event, handler] of this.#signalHandlers) {
      process.once(event, handler);
    }
    process.on("message", this.#onMessage);
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  get signaled(): Promise<typeof Shutdown.symbol | undefined> {
    return this.#signaled;
  }

  trigger(event?: string) {
    this.#onSignal(event);
  }

  [Symbol.dispose]() {
    this.#onSignal();
  }

  static readonly events = [
    "beforeExit",
    "disconnect",
    "SIGINT",
    "SIGTERM",
    "SIGHUP",
    "SIGQUIT",
    "SIGBREAK",
    "SIGUSR2",
  ] as const;

  static readonly symbol = Symbol("shutdown");

  static create(): Shutdown {
    return new Shutdown();
  }
}
