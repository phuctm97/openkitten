export class Errors extends Error {
  readonly errors: readonly unknown[];

  constructor(...errors: readonly unknown[]) {
    super(
      `${errors.length === 1 ? "An error" : `${errors.length} errors`} occurred`,
    );
    this.errors = errors;
  }

  static flatten(...errors: readonly unknown[]): readonly unknown[] {
    const result: unknown[] = [];
    for (const error of errors) {
      if (error instanceof Errors) {
        result.push(...Errors.flatten(...error.errors));
      } else {
        result.push(error);
      }
    }
    return result;
  }

  static throwIfAny<T>(
    results: PromiseSettledResult<T>[],
  ): asserts results is PromiseFulfilledResult<T>[] {
    const errors = Errors.flatten(
      ...results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => r.reason),
    );
    if (errors.length === 0) return;
    if (errors.length === 1) throw errors[0];
    throw new Errors(...errors);
  }
}
