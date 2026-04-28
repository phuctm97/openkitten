import type { auth } from "~/lib/auth";

export interface AuthContext {
  activeUser: typeof auth.$Infer.Session.user;
}
