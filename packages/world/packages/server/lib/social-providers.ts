import type { BetterAuthOptions } from "better-auth";

type SocialProviders = NonNullable<BetterAuthOptions["socialProviders"]>;

export const socialProviders: SocialProviders = {
  ...(Bun.env.GOOGLE_CLIENT_ID && Bun.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: Bun.env.GOOGLE_CLIENT_ID,
          clientSecret: Bun.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
  ...(Bun.env.GITHUB_CLIENT_ID && Bun.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: Bun.env.GITHUB_CLIENT_ID,
          clientSecret: Bun.env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
};
