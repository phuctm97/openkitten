import { useAuth } from "@better-auth-ui/react";
import type { AuthView as BetterAuthView } from "@better-auth-ui/react/core";

import { ForgotPassword } from "./forgot-password";
import { MagicLink } from "./magic-link";
import type { SocialLayout } from "./provider-buttons";
import { ResetPassword } from "./reset-password";
import { SignIn } from "./sign-in";
import { SignOut } from "./sign-out";
import { SignUp } from "./sign-up";

export type AuthRouterProps = {
  className?: string;
  path?: string;
  socialLayout?: SocialLayout;
  socialPosition?: "top" | "bottom";
  view?: BetterAuthView;
};

export function AuthRouter({
  className,
  view,
  path,
  socialLayout,
  socialPosition,
}: AuthRouterProps) {
  const { viewPaths } = useAuth();

  if (!view && !path) {
    throw new Error(
      "[Better Auth UI] Either `view` or `path` must be provided",
    );
  }

  const authPathViews = Object.fromEntries(
    Object.entries(viewPaths.auth).map(([k, v]) => [v, k]),
  ) as Record<string, BetterAuthView>;

  const currentView = view ?? authPathViews[String(path)];

  switch (currentView) {
    case "signIn":
      return (
        <SignIn
          className={className}
          socialLayout={socialLayout}
          socialPosition={socialPosition}
        />
      );
    case "signUp":
      return (
        <SignUp
          className={className}
          socialLayout={socialLayout}
          socialPosition={socialPosition}
        />
      );
    case "magicLink":
      return (
        <MagicLink
          className={className}
          socialLayout={socialLayout}
          socialPosition={socialPosition}
        />
      );
    case "forgotPassword":
      return <ForgotPassword className={className} />;
    case "resetPassword":
      return <ResetPassword className={className} />;
    case "signOut":
      return <SignOut className={className} />;
    default:
      throw new Error(
        `[Better Auth UI] Valid views are: ${Object.keys(viewPaths.auth).join(", ")}`,
      );
  }
}
