import { passkeyClient } from "@better-auth/passkey/client";
import { serverURL } from "@openkitten/world-util";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient(
  {
    baseURL: serverURL,
    basePath: "/auth",
    plugins: [magicLinkClient(), passkeyClient()],
  },
);
