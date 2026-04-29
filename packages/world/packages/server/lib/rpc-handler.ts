import { RPCHandler } from "@orpc/server/fetch";
import { router } from "~/lib/router";

export const rpcHandler = new RPCHandler(router);
