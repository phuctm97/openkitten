import { useAuthenticate } from "@better-auth-ui/react";
import { Outlet, replace } from "react-router";
import { LoadingState } from "~/components/loading-state";
import { authClient } from "~/lib/auth-client";
import { queryClient } from "~/lib/query-client";
import type { Route } from "./+types/authenticated";

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const authenticate = await queryClient.fetchQuery({
    queryKey: ["auth", "getSession", null],
    queryFn: ({ signal }) =>
      authClient.getSession({
        fetchOptions: {
          signal,
          throw: true,
        },
      }),
  });

  if (!authenticate) {
    const requestURL = new URL(request.url);
    const redirectTo = encodeURIComponent(
      `${requestURL.pathname}${requestURL.search}`,
    );

    throw replace(`/auth/sign-in?redirectTo=${redirectTo}`);
  }

  return null;
}

export default function Component() {
  const session = useAuthenticate();

  if (!session.data) {
    return <LoadingState />;
  }

  return <Outlet />;
}
