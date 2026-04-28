import {
  AuthProvider as BetterAuthProvider,
  type AuthProviderProps as BetterAuthProviderProps,
} from "@better-auth-ui/react";
import {
  isMagicLinkEnabled,
  isPasskeyEnabled,
  worldURL,
} from "@openkitten/world-util";
import type { PropsWithChildren } from "react";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { authClient } from "~/lib/auth-client";
import { queryClient } from "~/lib/query-client";
import { AuthLink } from "./auth-link";

const socialProviders = ["google", "github"] as const;

export function AuthProvider({ children }: PropsWithChildren) {
  const routerNavigate = useNavigate();
  const authNavigate = useCallback<BetterAuthProviderProps["navigate"]>(
    ({ to, replace }) => {
      routerNavigate(to, { replace });
    },
    [routerNavigate],
  );

  return (
    <BetterAuthProvider
      authClient={authClient}
      baseURL={worldURL}
      Link={AuthLink}
      navigate={authNavigate}
      queryClient={queryClient}
      redirectTo="/auth-callback"
      magicLink={isMagicLinkEnabled}
      passkey={isPasskeyEnabled}
      socialProviders={[...socialProviders]}
    >
      {children}
    </BetterAuthProvider>
  );
}
