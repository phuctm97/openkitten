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
import { APIError } from "better-auth/api";
import { magicLink, multiSession, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import EmailVerification from "~/lib/emails/email-verification";
import Invitation from "~/lib/emails/invitation";
import MagicLinkEmail from "~/lib/emails/magic-link";
import PasswordReset from "~/lib/emails/password-reset";
import { isPersonalHouse } from "~/lib/is-personal-house";
import { pgDatabase } from "~/lib/pg-database";
import { redis } from "~/lib/redis";
import * as schema from "~/lib/schema";
import { sendReactEmail } from "~/lib/send-react-email";
import { socialProviders } from "~/lib/social-providers";
import { syncWorkspace } from "~/lib/sync-workspace";

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

plugins.push(multiSession());

plugins.push(
  organization({
    cancelPendingInvitationsOnReInvite: true,
    requireEmailVerificationOnInvitation: true,
    schema: {
      organization: { modelName: "house" },
      member: {
        modelName: "house_member",
        fields: { organizationId: "house_id" },
      },
      invitation: {
        modelName: "house_invitation",
        fields: { organizationId: "house_id" },
      },
    },
    sendInvitationEmail: async ({ id, organization, inviter, email }) => {
      const invitationURL = new URL(`${worldURL}/accept-invitation`);
      invitationURL.searchParams.set("invitationId", id);
      try {
        await sendReactEmail({
          to: email,
          subject: `You've been invited to join ${organization.name} on OpenKitten`,
          element: (
            <Invitation
              organizationName={organization.name}
              inviterName={inviter.user.name}
              url={invitationURL.toString()}
            />
          ),
        });
      } catch (error) {
        console.error("[organization] failed to send invitation email", {
          invitationId: id,
          organizationId: organization.id,
          email,
          error,
        });
        throw error;
      }
    },
    organizationHooks: {
      afterCreateOrganization: async ({ organization, user }) => {
        try {
          await syncWorkspace({
            user,
            activeOrganizationId: organization.id,
          });
        } catch (error) {
          console.error(
            "[organization] failed to provision workspace, rolling back house",
            { organizationId: organization.id, userId: user.id, error },
          );
          await pgDatabase
            .delete(schema.house)
            .where(eq(schema.house.id, organization.id));
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to provision workspace",
          });
        }
      },
      beforeUpdateOrganization: async ({ member }) => {
        if (await isPersonalHouse(member.organizationId)) {
          throw new APIError("FORBIDDEN", {
            message:
              "Cannot update settings for a personal house. Create a new house to manage settings.",
          });
        }
      },
      beforeAddMember: async ({ member }) => {
        if (await isPersonalHouse(member.organizationId)) {
          throw new APIError("FORBIDDEN", {
            message:
              "Cannot add members to a personal house. Create a new house to invite collaborators.",
          });
        }
      },
      beforeRemoveMember: async ({ member }) => {
        if (await isPersonalHouse(member.organizationId)) {
          throw new APIError("FORBIDDEN", {
            message: "Cannot remove members from a personal house.",
          });
        }
      },
      beforeUpdateMemberRole: async ({ member }) => {
        if (await isPersonalHouse(member.organizationId)) {
          throw new APIError("FORBIDDEN", {
            message: "Cannot change member roles in a personal house.",
          });
        }
      },
      beforeCreateInvitation: async ({ organization }) => {
        if (await isPersonalHouse(organization.id)) {
          throw new APIError("FORBIDDEN", {
            message:
              "Cannot invite members to a personal house. Create a new house to invite collaborators.",
          });
        }
      },
      beforeDeleteOrganization: async ({ organization }) => {
        if (await isPersonalHouse(organization.id)) {
          throw new APIError("FORBIDDEN", {
            message:
              "Cannot delete a personal house. It is automatically managed for your account.",
          });
        }
      },
    },
  }),
);

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
        after: async (user) => {
          if (!isLive || user.emailVerified) {
            try {
              await syncWorkspace({ user });
            } catch (error) {
              console.error("[user.create.after] syncWorkspace failed", {
                userId: user.id,
                error,
              });
              throw error;
            }
          }
        },
      },
    },
  },
  rateLimit: { storage: "secondary-storage" },
  socialProviders,
  emailVerification: {
    sendOnSignUp: isLive,
    afterEmailVerification: async (user) => {
      if (isLive) {
        try {
          await syncWorkspace({ user });
        } catch (error) {
          console.error("[afterEmailVerification] syncWorkspace failed", {
            userId: user.id,
            error,
          });
          throw error;
        }
      }
    },
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
