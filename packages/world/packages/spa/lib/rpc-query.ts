import { createWorldQuery } from "@openkitten/world-client";
import { serverURL } from "@openkitten/world-util";

export const rpcQuery: ReturnType<typeof createWorldQuery> =
  createWorldQuery(serverURL);
