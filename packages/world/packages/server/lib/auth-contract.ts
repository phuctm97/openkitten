import { ORPCError } from "@orpc/server";
import { auth } from "~/lib/auth";
import { contract } from "~/lib/contract";

export const authContract = contract.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({ context: { activeUser: session.user } });
});
