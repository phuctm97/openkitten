import { homedir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { formatPath } from "~/lib/format-path";

test("replaces homedir with ~", () => {
  const path = join(homedir(), "projects", "file.ts");
  expect(formatPath(path)).toBe("~/projects/file.ts");
});

test("returns path unchanged when not under homedir", () => {
  expect(formatPath("/tmp/file.ts")).toBe("/tmp/file.ts");
});
