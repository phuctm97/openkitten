import { useSession } from "@better-auth-ui/react";
import { Link } from "react-router";

import { Button } from "~/components/ui/button";

export default function Component() {
  const { data: session } = useSession();

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="m-0 font-heading text-5xl text-foreground">
          Hello, world!
        </h1>
        {session?.user && (
          <Button asChild>
            <Link to="/auth/sign-out">Sign out</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
