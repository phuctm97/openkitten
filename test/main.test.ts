import { resolve } from "node:path";
import { expect, test } from "vitest";

test("cli runs and prints help", async () => {
  const proc = Bun.spawn(["bun", ".", "--help"], {
    cwd: resolve(import.meta.dirname, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  expect(code).toBe(0);
  expect(stdout).toContain("openkitten");
  expect(stdout).toContain("serve");
  expect(stdout).toContain("up");
  expect(stdout).toContain("down");
});
