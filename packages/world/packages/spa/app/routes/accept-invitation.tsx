import { data, useLoaderData } from "react-router";

import { AcceptInvitationCard } from "~/components/auth/accept-invitation-card";
import { authenticate } from "~/lib/authenticate";
import type { Route } from "./+types/accept-invitation";

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  await authenticate(request.url);
  const url = new URL(request.url);
  const invitationId = url.searchParams.get("invitationId");
  if (!invitationId) {
    throw data(null, { status: 404, statusText: "Not Found" });
  }
  return { invitationId };
}

export default function Component() {
  const { invitationId } = useLoaderData<typeof clientLoader>();
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10">
      <AcceptInvitationCard
        invitationId={invitationId}
        className="relative z-10"
      />
    </main>
  );
}
