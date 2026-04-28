import { expect, test } from "vitest";
import { contract, publicContract, userContract, userSchema } from "~/lib/main";

test("re-exports the merged contract", () => {
  expect(contract.me).toBeDefined();
});

test("re-exports the public contract", () => {
  expect(publicContract).toBeDefined();
});

test("re-exports the user contract", () => {
  expect(userContract.me).toBeDefined();
});

test("re-exports the user schema", () => {
  const user = userSchema.parse({
    id: "u_5",
    name: "Linus",
    email: "linus@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  expect(user.id).toBe("u_5");
});
