import {
  AuthProvider as BetterAuthProvider,
  type AuthProviderProps as BetterAuthProviderProps,
} from "@better-auth-ui/react";
import { worldURL } from "@openkitten/world-util";
import type { PropsWithChildren } from "react";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { authClient } from "~/lib/auth-client";
import { queryClient } from "~/lib/query-client";
import { AuthLink } from "./auth-link";

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
    >
      {children}
    </BetterAuthProvider>
  );
}
