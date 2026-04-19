import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { redis } from "bun";
import EmailVerification from "~/lib/emails/email-verification";
import PasswordReset from "~/lib/emails/password-reset";
import { isProduction } from "~/lib/is-production";
import { pgDatabase } from "~/lib/pg-database";
import * as schema from "~/lib/schema";
import { sendReactEmail } from "~/lib/send-react-email";
import { serverURL } from "~/lib/server-url";
import { websiteURL } from "~/lib/website-url";
import { worldURL } from "~/lib/world-url";

export const auth = betterAuth({
  appName: "OpenKitten",
  baseURL: serverURL,
  basePath: "/auth",
  trustedOrigins: [serverURL, worldURL, websiteURL],
  advanced: { cookiePrefix: "openkitten_auth" },
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
          if (!isProduction) {
            return { data: { emailVerified: true } };
          }
          return undefined;
        },
      },
    },
  },
  rateLimit: { storage: "secondary-storage" },
  emailVerification: {
    sendOnSignUp: isProduction,
    sendVerificationEmail: async ({ user, url }) => {
      await sendReactEmail({
        to: user.email,
        subject: "Verify your email - OpenKitten",
        element: <EmailVerification url={url} />,
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
});
