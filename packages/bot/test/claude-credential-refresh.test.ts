import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ClaudeCredentialRefresh } from "~/lib/claude-credential-refresh";
import { textEncoder } from "~/lib/text-encoder";

const validCredentials = {
  claudeAiOauth: {
    accessToken: "sk-ant-access-token",
    refreshToken: "sk-ant-refresh-token",
    expiresAt: Date.now() + 10 * 60 * 1000,
  },
};

function spawnResult(exitCode: number, stdout = "") {
  return {
    exited: Promise.resolve(exitCode),
    stdout: new ReadableStream<Uint8Array>({
      start(controller) {
        if (stdout) controller.enqueue(textEncoder.encode(stdout));
        controller.close();
      },
    }),
  };
}

let spawnMock: ReturnType<typeof vi.spyOn>;
let fetchMock: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  spawnMock?.mockRestore();
  fetchMock?.mockRestore();
  vi.useRealTimers();
});

function mockKeychainRead(data: unknown, exitCode = 0) {
  return spawnResult(exitCode, exitCode === 0 ? JSON.stringify(data) : "");
}

function mockSpawnSequence(results: ReturnType<typeof spawnResult>[]) {
  let callIndex = 0;
  spawnMock = vi.spyOn(Bun, "spawn").mockImplementation((() => {
    const result = results[callIndex];
    if (callIndex < results.length - 1) callIndex++;
    return result;
  }) as never);
}

test("disposes without error when no refresh needed", async () => {
  mockSpawnSequence([mockKeychainRead(validCredentials)]);
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
});

test("does nothing when credentials are not expiring soon", async () => {
  mockSpawnSequence([mockKeychainRead(validCredentials)]);
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("refreshes when token expires within threshold", async () => {
  const expiring = {
    claudeAiOauth: {
      ...validCredentials.claudeAiOauth,
      expiresAt: Date.now() + 2 * 60 * 1000,
    },
  };
  // Calls: read keychain, then after refresh: read keychain raw, delete, add
  mockSpawnSequence([
    mockKeychainRead(expiring),
    spawnResult(0, JSON.stringify(expiring)),
    spawnResult(0),
    spawnResult(0),
  ]);
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        access_token: "sk-ant-new-access",
        refresh_token: "sk-ant-new-refresh",
        expires_in: 36000,
      }),
    ),
  );
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://claude.ai/v1/oauth/token",
    expect.objectContaining({ method: "POST" }),
  );
});

test("handles keychain read failure gracefully", async () => {
  mockSpawnSequence([spawnResult(1)]);
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("handles missing claudeAiOauth gracefully", async () => {
  mockSpawnSequence([mockKeychainRead({ other: "data" })]);
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("handles OAuth refresh failure gracefully", async () => {
  const expiring = {
    claudeAiOauth: {
      ...validCredentials.claudeAiOauth,
      expiresAt: Date.now() + 2 * 60 * 1000,
    },
  };
  mockSpawnSequence([mockKeychainRead(expiring)]);
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("handles OAuth response without access_token", async () => {
  const expiring = {
    claudeAiOauth: {
      ...validCredentials.claudeAiOauth,
      expiresAt: Date.now() + 2 * 60 * 1000,
    },
  };
  mockSpawnSequence([mockKeychainRead(expiring)]);
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "invalid_grant" })),
  );
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
});

test("handles keychain write failure gracefully", async () => {
  const expiring = {
    claudeAiOauth: {
      ...validCredentials.claudeAiOauth,
      expiresAt: Date.now() + 2 * 60 * 1000,
    },
  };
  mockSpawnSequence([
    mockKeychainRead(expiring),
    // readKeychainRaw fails
    spawnResult(1),
  ]);
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        access_token: "sk-ant-new-access",
        expires_in: 36000,
      }),
    ),
  );
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
});

test("runs on interval", async () => {
  mockSpawnSequence([mockKeychainRead(validCredentials)]);
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  const initialCalls = spawnMock.mock.calls.length;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(spawnMock.mock.calls.length).toBeGreaterThan(initialCalls);
});

test("stops interval on dispose", async () => {
  mockSpawnSequence([mockKeychainRead(validCredentials)]);
  const refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  refresh[Symbol.dispose]();
  const callsAfterDispose = spawnMock.mock.calls.length;
  await vi.advanceTimersByTimeAsync(120_000);
  expect(spawnMock.mock.calls.length).toBe(callsAfterDispose);
});

test("double dispose is safe", async () => {
  mockSpawnSequence([mockKeychainRead(validCredentials)]);
  const refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  refresh[Symbol.dispose]();
  refresh[Symbol.dispose]();
});

test("preserves non-OAuth keychain data on write", async () => {
  const keychainData = {
    claudeAiOauth: {
      accessToken: "old",
      refreshToken: "old-refresh",
      expiresAt: Date.now() + 2 * 60 * 1000,
      scopes: ["user:inference"],
      subscriptionType: "max",
    },
    mcpOAuth: { some: "data" },
  };
  const spawnCalls: string[][] = [];
  spawnMock = vi.spyOn(Bun, "spawn").mockImplementation(((args: string[]) => {
    spawnCalls.push(args);
    // First call: readKeychain
    // Second call: readKeychainRaw (for write)
    // Third call: delete
    // Fourth call: add
    if (args.includes("find-generic-password")) {
      return spawnResult(0, JSON.stringify(keychainData));
    }
    return spawnResult(0);
  }) as never);
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 36000,
      }),
    ),
  );
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  const addCall = spawnCalls.find((args) =>
    args.includes("add-generic-password"),
  );
  expect(addCall).toBeDefined();
  const writtenJson = addCall?.[addCall.length - 1];
  const written = JSON.parse(writtenJson ?? "{}");
  expect(written.mcpOAuth).toEqual({ some: "data" });
  expect(written.claudeAiOauth.accessToken).toBe("new-access");
  expect(written.claudeAiOauth.refreshToken).toBe("new-refresh");
  expect(written.claudeAiOauth.scopes).toEqual(["user:inference"]);
  expect(written.claudeAiOauth.subscriptionType).toBe("max");
});

test("handles invalid JSON from keychain", async () => {
  mockSpawnSequence([spawnResult(0, "not json")]);
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("handles fetch throwing an error", async () => {
  const expiring = {
    claudeAiOauth: {
      ...validCredentials.claudeAiOauth,
      expiresAt: Date.now() + 2 * 60 * 1000,
    },
  };
  mockSpawnSequence([mockKeychainRead(expiring)]);
  fetchMock.mockRejectedValueOnce(new Error("network error"));
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
});

test("uses default expires_in when not provided", async () => {
  const expiring = {
    claudeAiOauth: {
      ...validCredentials.claudeAiOauth,
      expiresAt: Date.now() + 2 * 60 * 1000,
    },
  };
  const spawnCalls: string[][] = [];
  spawnMock = vi.spyOn(Bun, "spawn").mockImplementation(((args: string[]) => {
    spawnCalls.push(args);
    if (args.includes("find-generic-password")) {
      return spawnResult(0, JSON.stringify(expiring));
    }
    return spawnResult(0);
  }) as never);
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ access_token: "new-token" })),
  );
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  const addCall = spawnCalls.find((args) =>
    args.includes("add-generic-password"),
  );
  expect(addCall).toBeDefined();
  const written = JSON.parse(addCall?.[addCall.length - 1] ?? "{}");
  // Default 36000s = 10h from now
  const expectedMinExpiry = Date.now() + 35_000 * 1000;
  expect(written.claudeAiOauth.expiresAt).toBeGreaterThan(expectedMinExpiry);
});

test("keeps original refreshToken when response omits it", async () => {
  const expiring = {
    claudeAiOauth: {
      ...validCredentials.claudeAiOauth,
      expiresAt: Date.now() + 2 * 60 * 1000,
    },
  };
  const spawnCalls: string[][] = [];
  spawnMock = vi.spyOn(Bun, "spawn").mockImplementation(((args: string[]) => {
    spawnCalls.push(args);
    if (args.includes("find-generic-password")) {
      return spawnResult(0, JSON.stringify(expiring));
    }
    return spawnResult(0);
  }) as never);
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ access_token: "new-token" })),
  );
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  const addCall = spawnCalls.find((args) =>
    args.includes("add-generic-password"),
  );
  const written = JSON.parse(addCall?.[addCall.length - 1] ?? "{}");
  expect(written.claudeAiOauth.refreshToken).toBe("sk-ant-refresh-token");
});

test("incomplete credentials in keychain are ignored", async () => {
  mockSpawnSequence([
    mockKeychainRead({
      claudeAiOauth: { accessToken: "tok" },
    }),
  ]);
  using _refresh = ClaudeCredentialRefresh.create();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).not.toHaveBeenCalled();
});
