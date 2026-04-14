import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createAPIProxy } from "../lib/api-proxy";

interface TestAPI {
  echo(value: string): Promise<string>;
  add(a: number, b: number): Promise<number>;
}

let tmpDir: string;
let server: ReturnType<typeof Bun.serve>;
let token: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "api-proxy-"));
  token = "test-token-abc";
});

afterEach(async () => {
  server?.stop(true);
  await rm(tmpDir, { recursive: true });
});

function startRPCServer(
  impl: Record<string, (...args: never[]) => unknown>,
): string {
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (req) => {
      if (req.headers.get("authorization") !== `Bearer ${token}`) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const body = (await req.json()) as { method: string; args: unknown[] };
      const fn = impl[body.method];
      if (!fn) {
        return Response.json({ error: "Not Found" }, { status: 404 });
      }
      const result: unknown = await Reflect.apply(fn, undefined, body.args);
      return new Response(JSON.stringify(result), {
        headers: { "content-type": "application/json" },
      });
    },
  });
  return server.url.href.replace(/\/$/, "");
}

async function writeConfig(url: string): Promise<string> {
  const stateDir = join(tmpDir, "state");
  await mkdir(join(stateDir, "openkitten"), { recursive: true });
  await Bun.write(
    join(stateDir, "openkitten", "plugin-api.json"),
    JSON.stringify({ url, token }),
  );
  return stateDir;
}

test("calls server method and returns result", async () => {
  const url = startRPCServer({ echo: (v: string) => `hello ${v}` });
  const stateDir = await writeConfig(url);
  const proxy = createAPIProxy<TestAPI>(stateDir);
  const result = await proxy.echo("world");
  expect(result).toBe("hello world");
});

test("passes multiple arguments", async () => {
  const url = startRPCServer({ add: (a: number, b: number) => a + b });
  const stateDir = await writeConfig(url);
  const proxy = createAPIProxy<TestAPI>(stateDir);
  const result = await proxy.add(2, 3);
  expect(result).toBe(5);
});

test("throws RequestError on non-ok response", async () => {
  const url = startRPCServer({});
  const stateDir = await writeConfig(url);
  const proxy = createAPIProxy<TestAPI>(stateDir);
  await expect(proxy.echo("x")).rejects.toBeInstanceOf(
    createAPIProxy.RequestError,
  );
});

test("throws ConfigNotFoundError when config missing", async () => {
  const proxy = createAPIProxy<TestAPI>(join(tmpDir, "nonexistent"));
  await expect(proxy.echo("x")).rejects.toBeInstanceOf(
    createAPIProxy.ConfigNotFoundError,
  );
});

test("ConfigNotFoundError has path property", () => {
  const err = new createAPIProxy.ConfigNotFoundError("/some/path");
  expect(err.path).toBe("/some/path");
  expect(err.message).toContain("/some/path");
});

test("RequestError has status property", () => {
  const err = new createAPIProxy.RequestError(500, "fail");
  expect(err.status).toBe(500);
  expect(err.message).toContain("500");
});

test("caches connection after first call", async () => {
  let callCount = 0;
  const url = startRPCServer({
    echo: () => {
      callCount++;
      return "ok";
    },
  });
  const stateDir = await writeConfig(url);
  const proxy = createAPIProxy<TestAPI>(stateDir);
  await proxy.echo("a");
  await proxy.echo("b");
  expect(callCount).toBe(2);
});

test("uses XDG_STATE_HOME from env when no argument", async () => {
  const url = startRPCServer({ echo: (v: string) => v });
  const stateDir = join(tmpDir, "env-state");
  await mkdir(join(stateDir, "openkitten"), { recursive: true });
  await Bun.write(
    join(stateDir, "openkitten", "plugin-api.json"),
    JSON.stringify({ url, token }),
  );
  const original = Bun.env["XDG_STATE_HOME"];
  Bun.env["XDG_STATE_HOME"] = stateDir;
  try {
    const proxy = createAPIProxy<TestAPI>();
    const result = await proxy.echo("test");
    expect(result).toBe("test");
  } finally {
    Bun.env["XDG_STATE_HOME"] = original;
  }
});

test("falls back to HOME when XDG_STATE_HOME not set", () => {
  const originalState = Bun.env["XDG_STATE_HOME"];
  const originalHome = Bun.env["HOME"];
  Bun.env["XDG_STATE_HOME"] = undefined;
  Bun.env["HOME"] = "/test-home";
  try {
    const proxy = createAPIProxy<TestAPI>();
    expect(proxy).toBeDefined();
  } finally {
    Bun.env["XDG_STATE_HOME"] = originalState;
    Bun.env["HOME"] = originalHome;
  }
});

test("falls back to empty string when both env vars unset", () => {
  const originalState = Bun.env["XDG_STATE_HOME"];
  const originalHome = Bun.env["HOME"];
  Bun.env["XDG_STATE_HOME"] = undefined;
  Bun.env["HOME"] = undefined;
  try {
    const proxy = createAPIProxy<TestAPI>();
    expect(proxy).toBeDefined();
  } finally {
    Bun.env["XDG_STATE_HOME"] = originalState;
    Bun.env["HOME"] = originalHome;
  }
});

test("returns undefined for empty response body", async () => {
  const url = startRPCServer({
    empty: () => undefined,
  });
  const stateDir = await writeConfig(url);
  const proxy = createAPIProxy<{ empty(): Promise<undefined> }>(stateDir);
  const result = await proxy.empty();
  expect(result).toBeUndefined();
});

test("returns undefined for symbol properties", async () => {
  const proxy = createAPIProxy<TestAPI>(join(tmpDir, "x"));
  expect((proxy as never)[Symbol.toPrimitive]).toBeUndefined();
});

test("returns undefined for then (prevents Promise detection)", async () => {
  const proxy = createAPIProxy<TestAPI>(join(tmpDir, "x"));
  expect((proxy as never as { then: unknown }).then).toBeUndefined();
});
