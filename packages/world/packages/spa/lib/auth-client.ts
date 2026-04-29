import { passkeyClient } from "@better-auth/passkey/client";
import { serverURL } from "@openkitten/world-util";
import {
  magicLinkClient,
  multiSessionClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const _authClient = createAuthClient({
  baseURL: serverURL,
  basePath: "/auth",
  plugins: [
    magicLinkClient(),
    passkeyClient(),
    organizationClient(),
    multiSessionClient(),
  ],
});

export const authClient: typeof _authClient = _authClient;
