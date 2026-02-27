import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { Profile } from "~/lib/profile";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
}));

test("defaults to 'default' profile", async () => {
  const profile = await Profile.create();
  expect(profile.dir).toBe(
    join(homedir(), ".openkitten", "profiles", "default"),
  );
});

test("uses custom profile name", async () => {
  const profile = await Profile.create("work");
  expect(profile.dir).toBe(join(homedir(), ".openkitten", "profiles", "work"));
});

test("creates profile directories", async () => {
  const profile = await Profile.create("test");
  expect(mkdir).toHaveBeenCalledWith(join(profile.xdgData, "openkitten"), {
    recursive: true,
  });
  expect(mkdir).toHaveBeenCalledWith(profile.workspace, { recursive: true });
  expect(mkdir).toHaveBeenCalledWith(profile.opencode, { recursive: true });
});

test("system path is inside profile dir", async () => {
  const profile = await Profile.create("test");
  expect(profile.system).toBe(join(profile.dir, "system"));
});

test("workspace path is inside profile dir", async () => {
  const profile = await Profile.create("test");
  expect(profile.workspace).toBe(join(profile.dir, "workspace"));
});

test("auth path is inside openkitten data dir", async () => {
  const profile = await Profile.create("test");
  expect(profile.auth).toBe(join(profile.xdgData, "openkitten", "auth.json"));
});

test("database path is inside openkitten data dir", async () => {
  const profile = await Profile.create("test");
  expect(profile.database).toBe(
    join(profile.xdgData, "openkitten", "openkitten.db"),
  );
});

test("opencode config dir is inside profile dir", async () => {
  const profile = await Profile.create("test");
  expect(profile.opencode).toBe(join(profile.dir, ".opencode"));
});

test("xdg data path is inside system dir", async () => {
  const profile = await Profile.create("test");
  expect(profile.xdgData).toBe(join(profile.system, "data"));
});

test("xdg config path is inside system dir", async () => {
  const profile = await Profile.create("test");
  expect(profile.xdgConfig).toBe(join(profile.system, "config"));
});

test("xdg state path is inside system dir", async () => {
  const profile = await Profile.create("test");
  expect(profile.xdgState).toBe(join(profile.system, "state"));
});

test("xdg cache path is inside system dir", async () => {
  const profile = await Profile.create("test");
  expect(profile.xdgCache).toBe(join(profile.system, "cache"));
});
