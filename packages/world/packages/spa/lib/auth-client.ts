import { serverURL } from "@openkitten/world-util";
import { createAuthClient } from "better-auth/react";

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient(
  {
    baseURL: serverURL,
    basePath: "/auth",
  },
);
