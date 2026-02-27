import { logger } from "~/lib/logger";

export class Shutdown implements Disposable {
  readonly #controller: AbortController;
  readonly #signaled: Promise<void>;
  readonly #onSignal: (event?: string) => void;
  readonly #onMessage: (message: unknown) => void;

  private constructor() {
    this.#controller = new AbortController();

    const { resolve, promise: signaled } = Promise.withResolvers<void>();
    this.#signaled = signaled;

    this.#onSignal = (event?: string) => {
      if (this.#controller.signal.aborted) return;
      this.#controller.abort();
      logger.info("Shutdown is signaled", { event });
      for (const e of Shutdown.events) process.off(e, this.#onSignal);
      process.off("message", this.#onMessage);
      resolve();
    };

    this.#onMessage = (message: unknown) => {
      if (message === "shutdown") this.#onSignal("shutdown");
    };

    for (const event of Shutdown.events) process.once(event, this.#onSignal);
    process.on("message", this.#onMessage);
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  get signaled(): Promise<void> {
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

  static create(): Shutdown {
    return new Shutdown();
  }
}
