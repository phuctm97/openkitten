export class FloatingPromises implements AsyncDisposable {
  readonly #promises = new Set<Promise<unknown>>();

  track(promise: Promise<unknown>) {
    if (this.#promises.has(promise)) return;
    this.#promises.add(promise);
    promise.then(
      () => this.#promises.delete(promise),
      () => this.#promises.delete(promise),
    );
  }

  async settle() {
    while (this.#promises.size > 0) {
      await Promise.allSettled(this.#promises);
    }
  }

  async [Symbol.asyncDispose]() {
    await this.settle();
  }

  static create(): FloatingPromises {
    return new FloatingPromises();
  }
}
