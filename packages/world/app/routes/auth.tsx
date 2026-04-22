import { AuthRouter } from "~/components/auth/auth-router";
import type { Route } from "./+types/auth";

export default function Component({ params }: Route.ComponentProps) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-40 [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
        <div className="absolute left-[-8rem] top-[-6rem] size-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] size-96 rounded-full bg-accent/60 blur-3xl" />
      </div>
      <AuthRouter className="relative z-10" path={params.path} />
    </main>
  );
}
