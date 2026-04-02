import { expect, test } from "vitest";
import { FloatingPromises } from "~/lib/floating-promises";

test("dispose settles all promises", async () => {
  let resolved = false;
  const { resolve, promise } = Promise.withResolvers<void>();
  {
    await using fp = FloatingPromises.create();
    fp.track(
      promise.then(() => {
        resolved = true;
      }),
    );
    resolve();
  }
  expect(resolved).toBe(true);
});

test("settle resolves immediately when empty", async () => {
  const fp = FloatingPromises.create();
  await fp.settle();
});

test("settle waits for tracked promise to resolve", async () => {
  const fp = FloatingPromises.create();
  let resolved = false;
  const { resolve, promise } = Promise.withResolvers<void>();
  fp.track(
    promise.then(() => {
      resolved = true;
    }),
  );
  resolve();
  await fp.settle();
  expect(resolved).toBe(true);
});

test("settle waits for tracked promise to reject", async () => {
  const fp = FloatingPromises.create();
  const { reject, promise } = Promise.withResolvers<void>();
  fp.track(promise);
  reject(new Error("fail"));
  await fp.settle();
});

test("ignores duplicate promise reference", async () => {
  const fp = FloatingPromises.create();
  const promise = Promise.resolve();
  fp.track(promise);
  fp.track(promise);
  await fp.settle();
});

test("auto-removes resolved promises", async () => {
  const fp = FloatingPromises.create();
  fp.track(Promise.resolve());
  await fp.settle();
  // Second settle should resolve immediately (nothing tracked)
  await fp.settle();
});

test("settle loops until empty when promises are tracked during settling", async () => {
  const fp = FloatingPromises.create();
  let secondAdded = false;
  const { resolve: resolve1, promise: promise1 } =
    Promise.withResolvers<void>();
  fp.track(
    promise1.then(() => {
      if (!secondAdded) {
        secondAdded = true;
        fp.track(Promise.resolve());
      }
    }),
  );
  resolve1();
  await fp.settle();
  expect(secondAdded).toBe(true);
});
