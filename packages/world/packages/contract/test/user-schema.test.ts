import { expect, test } from "vitest";
import { userSchema } from "~/lib/user-schema";

test("accepts a valid user object", () => {
  const user = userSchema.parse({
    id: "u_1",
    name: "Ada",
    email: "ada@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date("2026-04-28T00:00:00Z"),
    updatedAt: new Date("2026-04-28T00:00:00Z"),
  });
  expect(user.id).toBe("u_1");
  expect(user.image).toBeNull();
});

test("accepts a user with an image url", () => {
  const user = userSchema.parse({
    id: "u_2",
    name: "Grace",
    email: "grace@example.com",
    emailVerified: false,
    image: "https://cdn.example.com/avatar.png",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  expect(user.image).toBe("https://cdn.example.com/avatar.png");
});

test("accepts a user when image is omitted", () => {
  const user = userSchema.parse({
    id: "u_omit",
    name: "Hopper",
    email: "hopper@example.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  expect(user.image).toBeUndefined();
});

test("rejects when required fields are missing", () => {
  expect(() => userSchema.parse({ id: "u_3" })).toThrow();
});

test("rejects when emailVerified is not a boolean", () => {
  expect(() =>
    userSchema.parse({
      id: "u_4",
      name: "Alan",
      email: "alan@example.com",
      emailVerified: "yes",
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ).toThrow();
});
