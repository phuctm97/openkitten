import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { Profile } from "~/lib/profile";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
}));

const original = Bun.env["OPENKITTEN_PROFILE"];

afterEach(() => {
  if (original === undefined) {
    delete Bun.env["OPENKITTEN_PROFILE"];
  } else {
    Bun.env["OPENKITTEN_PROFILE"] = original;
  }
});

test("defaults to 'default' profile", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.name).toBe("default");
  expect(profile.dir).toBe(
    join(homedir(), ".openkitten", "profiles", "default"),
  );
});

test("uses OPENKITTEN_PROFILE env var", async () => {
  Bun.env["OPENKITTEN_PROFILE"] = "work";
  const profile = await Profile.create();
  expect(profile.name).toBe("work");
  expect(profile.dir).toBe(join(homedir(), ".openkitten", "profiles", "work"));
});

test("creates profile directories", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(mkdir).toHaveBeenCalledWith(profile.workspace, { recursive: true });
  expect(mkdir).toHaveBeenCalledWith(profile.opencode, { recursive: true });
  expect(mkdir).toHaveBeenCalledWith(profile.openkitten, { recursive: true });
});

test("system path is inside profile dir", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.system).toBe(join(profile.dir, "system"));
});

test("workspace path is inside profile dir", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.workspace).toBe(join(profile.dir, "workspace"));
});

test("auth path is inside openkitten data dir", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.auth).toBe(join(profile.openkitten, "auth.json"));
});

test("database path is inside openkitten data dir", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.database).toBe(join(profile.openkitten, "openkitten.db"));
});

test("opencode config dir is inside profile dir", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.opencode).toBe(join(profile.dir, ".opencode"));
});

test("openkitten data dir is inside xdg data dir", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.openkitten).toBe(join(profile.xdgData, "openkitten"));
});

test("xdg data path is inside system dir", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.xdgData).toBe(join(profile.system, "data"));
});

test("xdg config path is inside system dir", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.xdgConfig).toBe(join(profile.system, "config"));
});

test("xdg state path is inside system dir", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.xdgState).toBe(join(profile.system, "state"));
});

test("xdg cache path is inside system dir", async () => {
  delete Bun.env["OPENKITTEN_PROFILE"];
  const profile = await Profile.create();
  expect(profile.xdgCache).toBe(join(profile.system, "cache"));
});
