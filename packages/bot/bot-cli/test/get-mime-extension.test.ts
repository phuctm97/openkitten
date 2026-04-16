import { expect, test } from "vitest";
import { getMimeExtension } from "~/lib/get-mime-extension";

test("returns the extension for a mime type", () => {
  expect(getMimeExtension("image/png")).toBe("png");
});

test("returns the extension for mime types with parameters", () => {
  expect(getMimeExtension("image/png; charset=utf-8")).toBe("png");
});

test("returns undefined when the mime type is unknown", () => {
  expect(getMimeExtension("made/up")).toBeUndefined();
  expect(getMimeExtension(undefined)).toBeUndefined();
});
