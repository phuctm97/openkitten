import { createWorldQuery } from "@openkitten/world-client";
import { serverURL } from "@openkitten/world-util";
import { getActiveOrganizationId } from "~/lib/active-organization-id";

export const rpcQuery: ReturnType<typeof createWorldQuery> = createWorldQuery(
  serverURL,
  { getActiveOrganizationId },
);
