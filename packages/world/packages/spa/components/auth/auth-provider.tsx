import {
  AuthProvider as BetterAuthProvider,
  type AuthProviderProps as BetterAuthProviderProps,
} from "@better-auth-ui/react";
import {
  isMagicLinkEnabled,
  isPasskeyEnabled,
  worldURL,
} from "@openkitten/world-util";
import { useSetAtom } from "jotai";
import type { PropsWithChildren } from "react";
import { useCallback } from "react";
import { authClient } from "~/lib/auth-client";
import { navigateAtom } from "~/lib/navigate-atom";
import { queryClient } from "~/lib/query-client";
import { AuthLink } from "./auth-link";

const socialProviders = ["google", "github"] as const;

export function AuthProvider({ children }: PropsWithChildren) {
  const navigate = useSetAtom(navigateAtom);
  const authNavigate = useCallback<BetterAuthProviderProps["navigate"]>(
    ({ to, replace }) => {
      void navigate(to, { replace });
    },
    [navigate],
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
      multiSession={false}
      socialProviders={[...socialProviders]}
    >
      {children}
    </BetterAuthProvider>
  );
}
