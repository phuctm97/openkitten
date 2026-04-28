import { authContract } from "~/lib/auth-contract";

export const me = authContract.me.handler(({ context }) => context.activeUser);
