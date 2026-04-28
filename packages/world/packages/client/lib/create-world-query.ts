import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createWorldClient } from "./create-world-client";

export function createWorldQuery(
  serverURL: string,
): ReturnType<
  typeof createTanstackQueryUtils<ReturnType<typeof createWorldClient>>
> {
  return createTanstackQueryUtils(createWorldClient(serverURL));
}
