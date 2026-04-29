import { Settings } from "~/components/settings/settings";
import { authenticate } from "~/lib/authenticate";
import type { Route } from "./+types/account";

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  await authenticate(request.url);
  return null;
}

export default function Component() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Settings view="account" />
    </main>
  );
}
