import { passkey } from "@better-auth/passkey";
import {
  isLive,
  isMagicLinkEnabled,
  isPasskeyEnabled,
  serverURL,
  websiteURL,
  worldURL,
} from "@openkitten/world-util";
import type { BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import EmailVerification from "~/lib/emails/email-verification";
import MagicLinkEmail from "~/lib/emails/magic-link";
import PasswordReset from "~/lib/emails/password-reset";
import { pgDatabase } from "~/lib/pg-database";
import { redis } from "~/lib/redis";
import * as schema from "~/lib/schema";
import { sendReactEmail } from "~/lib/send-react-email";
import { socialProviders } from "~/lib/social-providers";

const authCallbackURL = `${worldURL}/auth-callback`;
const worldOrigin = new URL(worldURL).origin;

function isAllowedCallbackURL(callbackURL: string): boolean {
  try {
    return new URL(callbackURL).origin === worldOrigin;
  } catch {
    return false;
  }
}

function ensureAuthCallback(rawURL: string): string {
  const url = new URL(rawURL);
  const callbackURL = url.searchParams.get("callbackURL");
  if (
    !callbackURL ||
    callbackURL === "/" ||
    !isAllowedCallbackURL(callbackURL)
  ) {
    url.searchParams.set("callbackURL", authCallbackURL);
  }
  return url.toString();
}

const plugins: BetterAuthPlugin[] = [];

if (isMagicLinkEnabled) {
  plugins.push(
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendReactEmail({
          to: email,
          subject: "Sign in to OpenKitten",
          element: <MagicLinkEmail url={ensureAuthCallback(url)} />,
        });
      },
    }),
  );
}

if (isPasskeyEnabled) {
  plugins.push(
    passkey({
      rpName: "OpenKitten",
      rpID: new URL(worldURL).hostname,
      origin: worldURL,
    }),
  );
}

export const auth = betterAuth({
  appName: "OpenKitten",
  baseURL: serverURL,
  basePath: "/auth",
  trustedOrigins: [serverURL, worldURL, websiteURL],
  advanced: {
    cookiePrefix: "openkitten_auth",
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: isLive,
    },
  },
  database: drizzleAdapter(pgDatabase, { provider: "pg", schema }),
  secondaryStorage: {
    get: (key) => redis.get(key),
    set: async (key, value, ttl) => {
      await (typeof ttl === "number"
        ? redis.set(key, value, "EX", ttl)
        : redis.set(key, value));
    },
    delete: async (key) => {
      await redis.del(key);
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          if (!isLive) {
            return { data: { emailVerified: true } };
          }
          return undefined;
        },
      },
    },
  },
  rateLimit: { storage: "secondary-storage" },
  socialProviders,
  emailVerification: {
    sendOnSignUp: isLive,
    sendVerificationEmail: async ({ user, url }) => {
      await sendReactEmail({
        to: user.email,
        subject: "Verify your email - OpenKitten",
        element: <EmailVerification url={ensureAuthCallback(url)} />,
      });
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      await sendReactEmail({
        to: user.email,
        subject: "Reset your password - OpenKitten",
        element: <PasswordReset url={url} />,
      });
    },
  },
  plugins,
});
