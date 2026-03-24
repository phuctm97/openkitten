import { afterEach, expect, test } from "vitest";
import { getProfile } from "~/lib/get-profile";

const original = Bun.env["OPENKITTEN_PROFILE"];

afterEach(() => {
  if (original === undefined) {
    delete Bun.env["OPENKITTEN_PROFILE"];
  } else {
    Bun.env["OPENKITTEN_PROFILE"] = original;
  }
});

test("returns default when env is unset", () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  expect(getProfile()).toBe("default");
});

test("returns env value when set", () => {
  Bun.env["OPENKITTEN_PROFILE"] = "work";
  expect(getProfile()).toBe("work");
});
