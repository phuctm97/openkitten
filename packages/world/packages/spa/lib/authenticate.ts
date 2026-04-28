import { replace } from "react-router";
import { getSession } from "~/lib/get-session";
import { produceCallback } from "~/lib/produce-callback";

export async function authenticate(url: string) {
  const session = await getSession();

  if (!session) {
    produceCallback(url);
    throw replace("/auth/sign-in");
  }

  if (!session.user.emailVerified) {
    produceCallback(url);
    throw replace("/auth/verify-email");
  }

  return session;
}
