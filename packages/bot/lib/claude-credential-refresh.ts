import { logger } from "~/lib/logger";

const keychainService = "Claude Code-credentials";

const oauthTokenUrl = "https://claude.ai/v1/oauth/token";

const oauthClientId = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

// Refresh when the token has 5 minutes or less remaining.
const refreshThresholdMs = 5 * 60 * 1000;

// Check every 60 seconds.
const checkIntervalMs = 60 * 1000;

interface Credentials {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

interface KeychainData {
  readonly claudeAiOauth?: {
    readonly accessToken?: string;
    readonly refreshToken?: string;
    readonly expiresAt?: number;
  };
}

function parseKeychainData(raw: string): Credentials | null {
  const data: KeychainData = JSON.parse(raw);
  const oauth = data.claudeAiOauth;
  if (
    typeof oauth?.accessToken !== "string" ||
    typeof oauth?.refreshToken !== "string" ||
    typeof oauth?.expiresAt !== "number"
  )
    return null;
  return {
    accessToken: oauth.accessToken,
    refreshToken: oauth.refreshToken,
    expiresAt: oauth.expiresAt,
  };
}

async function readKeychain(): Promise<Credentials | null> {
  const proc = Bun.spawn(
    ["security", "find-generic-password", "-s", keychainService, "-w"],
    { stdout: "pipe", stderr: "ignore" },
  );
  const code = await proc.exited;
  if (code !== 0) return null;
  const raw = await new Response(proc.stdout).text();
  return parseKeychainData(raw.trim());
}

interface OAuthTokenResponse {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
}

async function refreshViaOAuth(
  refreshToken: string,
): Promise<Credentials | null> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: oauthClientId,
    refresh_token: refreshToken,
  });
  const response = await fetch(oauthTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as OAuthTokenResponse;
  if (!data.access_token) return null;
  const now = Date.now();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: now + (data.expires_in ?? 36_000) * 1000,
  };
}

async function writeKeychain(credentials: Credentials): Promise<boolean> {
  const raw = await readKeychainRaw();
  if (raw === null) return false;
  const data = JSON.parse(raw);
  data.claudeAiOauth = {
    ...data.claudeAiOauth,
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken,
    expiresAt: credentials.expiresAt,
  };
  const updated = JSON.stringify(data);
  // security delete + add is the standard way to update a keychain entry.
  const del = Bun.spawn(
    ["security", "delete-generic-password", "-s", keychainService],
    { stdout: "ignore", stderr: "ignore" },
  );
  await del.exited;
  const add = Bun.spawn(
    [
      "security",
      "add-generic-password",
      "-s",
      keychainService,
      "-a",
      "",
      "-w",
      updated,
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  return (await add.exited) === 0;
}

async function readKeychainRaw(): Promise<string | null> {
  const proc = Bun.spawn(
    ["security", "find-generic-password", "-s", keychainService, "-w"],
    { stdout: "pipe", stderr: "ignore" },
  );
  if ((await proc.exited) !== 0) return null;
  const raw = await new Response(proc.stdout).text();
  return raw.trim();
}

export class ClaudeCredentialRefresh implements Disposable {
  #timer: Timer | undefined;

  private constructor(timer: Timer) {
    this.#timer = timer;
  }

  [Symbol.dispose]() {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  static create(): ClaudeCredentialRefresh {
    const tick = async () => {
      try {
        const credentials = await readKeychain();
        if (!credentials) {
          logger.debug("Claude credential refresh: no credentials in Keychain");
          return;
        }
        const remaining = credentials.expiresAt - Date.now();
        if (remaining > refreshThresholdMs) return;
        logger.info(
          "Claude credential refresh: token expiring soon, refreshing",
          {
            remainingMs: remaining,
          },
        );
        const refreshed = await refreshViaOAuth(credentials.refreshToken);
        if (!refreshed) {
          logger.warn("Claude credential refresh: OAuth refresh failed");
          return;
        }
        const written = await writeKeychain(refreshed);
        if (written) {
          logger.info(
            "Claude credential refresh: token refreshed successfully",
            {
              expiresAt: refreshed.expiresAt,
            },
          );
        } else {
          logger.warn("Claude credential refresh: failed to write to Keychain");
        }
      } catch (error) {
        logger.warn("Claude credential refresh: unexpected error", error);
      }
    };
    // Run immediately on creation, then every checkIntervalMs.
    tick();
    const timer = setInterval(tick, checkIntervalMs);
    timer.unref();
    return new ClaudeCredentialRefresh(timer);
  }
}
