import { createClient } from "@openkitten/world-client";
import { serverURL } from "@openkitten/world-util";
import { getActiveOrganizationId } from "~/lib/get-active-organization-id";

export const orpcClient: ReturnType<typeof createClient> = createClient(
  serverURL,
  { getActiveOrganizationId },
);
