import { createAuthClient } from "better-auth/react";
import { serverURL } from "~/lib/server-url";

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient(
  {
    baseURL: serverURL,
    basePath: "/auth",
  },
);
