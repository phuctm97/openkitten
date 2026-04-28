import { expect, test } from "vitest";
import { userContract } from "~/lib/user-contract";

test("me procedure is defined", () => {
  expect(userContract.me).toBeDefined();
});

test("me has an output schema that accepts a valid user", () => {
  const def = userContract.me["~orpc"];
  expect(def.outputSchema).toBeDefined();
  const result: unknown = def.outputSchema?.parse({
    id: "u_1",
    name: "Ada",
    email: "ada@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date("2026-04-28T00:00:00Z"),
    updatedAt: new Date("2026-04-28T00:00:00Z"),
  });
  expect(result).toMatchObject({ id: "u_1", name: "Ada" });
});

test("me output schema rejects invalid payload", () => {
  const def = userContract.me["~orpc"];
  expect(() => def.outputSchema?.parse({ id: 0 })).toThrow();
});
