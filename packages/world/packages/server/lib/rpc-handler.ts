import { RPCHandler } from "@orpc/server/fetch";
import * as router from "~/lib/router";

export const rpcHandler = new RPCHandler(router);
