import { useAuthenticate } from "@better-auth-ui/react";
import { Outlet } from "react-router";
import { LoadingState } from "~/components/loading-state";
import { authenticate } from "~/lib/authenticate";
import type { Route } from "./+types/authenticated";

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  await authenticate(request.url);
  return null;
}

export default function Component() {
  const session = useAuthenticate();

  if (!session.data) {
    return <LoadingState />;
  }

  return <Outlet />;
}
