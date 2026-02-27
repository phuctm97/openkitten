import { expect, test } from "vitest";
import { Errors } from "~/lib/errors";

test("stores errors and formats message", () => {
  const errors = new Errors(new Error("a"), new Error("b"));
  expect(errors.errors).toHaveLength(2);
  expect(errors.message).toBe("2 errors occurred");
  expect(errors).toBeInstanceOf(Error);
});

test("singular message for one error", () => {
  const errors = new Errors(new Error("a"));
  expect(errors.message).toBe("An error occurred");
});

test("flatten unwraps nested Errors", () => {
  const inner = new Errors(new Error("a"), new Error("b"));
  const outer = new Errors(inner, new Error("c"));
  const flat = Errors.flatten(outer);
  expect(flat).toHaveLength(3);
  expect(flat.map((e) => (e as Error).message)).toEqual(["a", "b", "c"]);
});

test("flatten passes through non-Error values", () => {
  const flat = Errors.flatten("string error", 42);
  expect(flat).toHaveLength(2);
  expect(flat[0]).toBe("string error");
  expect(flat[1]).toBe(42);
});

test("flatten passes through plain errors", () => {
  const error = new Error("plain");
  const flat = Errors.flatten(error);
  expect(flat).toEqual([error]);
});

test("throwIfAny does nothing when all fulfilled", () => {
  Errors.throwIfAny([
    { status: "fulfilled", value: undefined },
    { status: "fulfilled", value: 42 },
  ]);
});

test("throwIfAny throws single error directly", () => {
  const error = new Error("fail");
  expect(() =>
    Errors.throwIfAny([
      { status: "fulfilled", value: undefined },
      { status: "rejected", reason: error },
    ]),
  ).toThrow(error);
});

test("throwIfAny throws Errors for multiple rejections", () => {
  const a = new Error("a");
  const b = new Error("b");
  expect(() =>
    Errors.throwIfAny([
      { status: "rejected", reason: a },
      { status: "rejected", reason: b },
    ]),
  ).toThrow(Errors);
});

test("throwIfAny flattens nested Errors", () => {
  const inner = new Errors(new Error("a"), new Error("b"));
  try {
    Errors.throwIfAny([
      { status: "rejected", reason: inner },
      { status: "rejected", reason: new Error("c") },
    ]);
  } catch (error) {
    expect(error).toBeInstanceOf(Errors);
    expect((error as Errors).errors).toHaveLength(3);
  }
});
