import { expect, test } from "vitest";
import { getFileExtension } from "~/lib/get-file-extension";

test("returns lowercase file extensions", () => {
  expect(getFileExtension("photo.PNG")).toBe("png");
});

test("returns undefined when there is no extension", () => {
  expect(getFileExtension("photo")).toBeUndefined();
  expect(getFileExtension("photo.")).toBeUndefined();
});
