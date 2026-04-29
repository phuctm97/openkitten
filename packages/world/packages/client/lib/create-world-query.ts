import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import {
  type CreateWorldClientOptions,
  createWorldClient,
} from "./create-world-client";

export function createWorldQuery(
  serverURL: string,
  options: CreateWorldClientOptions = {},
): ReturnType<
  typeof createTanstackQueryUtils<ReturnType<typeof createWorldClient>>
> {
  return createTanstackQueryUtils(createWorldClient(serverURL, options));
}
