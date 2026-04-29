import { useQuery } from "@tanstack/react-query";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { Link, NavLink, Outlet, replace, useLocation } from "react-router";

import { OrganizationSwitcher } from "~/components/auth/organization-switcher";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Spinner } from "~/components/ui/spinner";
import { authenticate } from "~/lib/authenticate";
import { rpcQuery } from "~/lib/rpc-query";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/workspace";

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  await authenticate(request.url);
  const url = new URL(request.url);
  if (url.pathname === "/workspace" || url.pathname === "/workspace/") {
    throw replace("/workspace/members");
  }
  return null;
}

const tabs = [
  { value: "members", label: "Members", to: "/workspace/members" },
  { value: "settings", label: "Settings", to: "/workspace/settings" },
];

export default function Component() {
  const { data, isLoading, isError } = useQuery(
    rpcQuery.workspace.sync.queryOptions(),
  );
  const location = useLocation();

  const isPersonal = data ? data.workspace.isPersonal : false;
  const houseId = data?.house.id;
  const houseName = data?.house.name;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              OpenKitten
            </Link>
            <span aria-hidden> / </span>House
          </p>
          <h1 className="mt-1 font-heading text-3xl text-foreground">
            {houseName ?? "House"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage members and settings for this house.
          </p>
        </div>
        <OrganizationSwitcher />
      </header>

      <nav aria-label="House sections" className="mb-6 flex gap-1 border-b">
        {tabs.map((tab) =>
          isPersonal ? (
            <span
              key={tab.value}
              aria-disabled="true"
              className="cursor-not-allowed border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground/50"
            >
              {tab.label}
            </span>
          ) : (
            <NavLink
              key={tab.value}
              to={tab.to}
              end
              className={({ isActive }) =>
                cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              {tab.label}
            </NavLink>
          ),
        )}
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : isError || !houseId ? (
        <Alert variant="destructive">
          <TriangleAlertIcon className="size-4" />
          <AlertTitle>Couldn't load this house</AlertTitle>
          <AlertDescription>
            Something went wrong while loading your house. Try refreshing or
            switching to another house.
          </AlertDescription>
        </Alert>
      ) : isPersonal ? (
        <Alert>
          <InfoIcon className="size-4" />
          <AlertTitle>Personal house</AlertTitle>
          <AlertDescription>
            {location.pathname.endsWith("/members")
              ? "Members are only available for collaborative houses. Create a new house from the switcher above to invite teammates."
              : "House settings are only available for collaborative houses. Create a new house from the switcher above to manage settings."}
          </AlertDescription>
        </Alert>
      ) : (
        <Outlet context={{ organizationId: houseId } as const} />
      )}
    </main>
  );
}
