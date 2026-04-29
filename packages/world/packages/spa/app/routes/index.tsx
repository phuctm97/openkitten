import { useQuery } from "@tanstack/react-query";
import { HomeIcon } from "lucide-react";
import { Link } from "react-router";

import { OrganizationSwitcher } from "~/components/auth/organization-switcher";
import { Button } from "~/components/ui/button";
import { UserButton } from "~/components/user/user-button";
import { rpcQuery } from "~/lib/rpc-query";

export default function Component() {
  const { data } = useQuery(rpcQuery.workspace.sync.queryOptions());
  const showHouseSettingsCta = data ? !data.workspace.isPersonal : false;

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <h1 className="m-0 font-heading text-5xl text-foreground">
          OpenKitten
        </h1>

        <OrganizationSwitcher className="w-full" />

        <nav aria-label="Home destinations" className="flex gap-4">
          <Link className="underline underline-offset-4" to="/app">
            Go to /app
          </Link>
          <Link className="underline underline-offset-4" to="/game">
            Go to /game
          </Link>
        </nav>

        {showHouseSettingsCta && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/workspace/settings">
              <HomeIcon className="size-4" />
              House settings
            </Link>
          </Button>
        )}

        <UserButton />
      </div>
    </main>
  );
}
