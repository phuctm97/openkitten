import { data, replace } from "react-router";
import { AuthRouter } from "~/components/auth/auth-router";
import { VerifyEmail } from "~/components/auth/verify-email";
import { getSession } from "~/lib/get-session";
import { retrieveCallback } from "~/lib/retrieve-callback";
import type { Route } from "./+types/auth";

const authPaths = new Set([
  "sign-up",
  "sign-in",
  "sign-out",
  "reset-password",
  "forgot-password",
  "magic-link",
  "verify-email",
]);

function pathResolver(request: Request) {
  const requestURL = new URL(request.url);
  const redirectTo = requestURL.searchParams.get("redirectTo");

  if (redirectTo) {
    const redirectURL = new URL(redirectTo, requestURL.origin);
    if (redirectURL.origin === requestURL.origin) {
      return `${redirectURL.pathname}${redirectURL.search}${redirectURL.hash}`;
    }
  }

  const stored = retrieveCallback();
  if (stored) {
    return stored;
  }

  return "/";
}

export async function clientLoader({
  params,
  request,
}: Route.ClientLoaderArgs) {
  const path = params.path ?? "";

  if (!authPaths.has(path)) {
    throw data(null, {
      status: 404,
      statusText: "Not Found",
    });
  }

  const session = await getSession();

  if (path === "verify-email") {
    if (!session) {
      throw replace("/auth/sign-in");
    }
    if (session.user.emailVerified) {
      throw replace(pathResolver(request));
    }
    return null;
  }

  if (session && path !== "sign-out") {
    throw replace(pathResolver(request));
  }

  if (!session && path === "sign-out") {
    throw replace("/auth/sign-in");
  }

  return null;
}

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
      {params.path === "verify-email" ? (
        <VerifyEmail className="relative z-10" />
      ) : (
        <AuthRouter className="relative z-10" path={params.path} />
      )}
    </main>
  );
}
