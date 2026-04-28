import { replace } from "react-router";
import { LoadingState } from "~/components/loading-state";
import { consumeCallback } from "~/lib/consume-callback";
import { getSession } from "~/lib/get-session";

export async function clientLoader() {
  const session = await getSession();

  if (!session) {
    throw replace("/auth/sign-in");
  }

  if (!session.user.emailVerified) {
    throw replace("/auth/verify-email");
  }

  throw replace(consumeCallback());
}

export default function Component() {
  return <LoadingState />;
}
