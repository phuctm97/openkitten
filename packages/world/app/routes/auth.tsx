import { AuthRouter } from "~/components/auth/auth-router";
import type { Route } from "./+types/auth";

export default function Component({ params }: Route.ComponentProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10">
      <AuthRouter path={params.path} />
    </main>
  );
}
