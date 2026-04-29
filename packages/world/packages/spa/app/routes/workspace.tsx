import { useQuery } from "@tanstack/react-query";
import { InfoIcon } from "lucide-react";
import { Outlet, replace, useLocation, useNavigate } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Spinner } from "~/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { authenticate } from "~/lib/authenticate";
import { orpcUtils } from "~/lib/orpc-utils";
import { PageBreadcrumb } from "~/lib/page-breadcrumb";
import { QueryErrorAlert } from "~/lib/query-error-alert";
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
] as const;

export default function Component() {
  const { data, isPending, isError, error, isRefetching, refetch } = useQuery(
    orpcUtils.workspace.sync.queryOptions(),
  );
  const location = useLocation();
  const navigate = useNavigate();

  const isPersonal = data?.workspace.isPersonal ?? false;
  const activeTab = location.pathname.endsWith("/settings")
    ? "settings"
    : "members";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-20 pb-10 sm:px-6 lg:pt-24">
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <PageBreadcrumb
            items={[{ label: "Home", to: "/" }, { label: "House" }]}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-heading text-3xl text-foreground">House</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage members and settings for this house.
              </p>
            </div>
          </div>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = tabs.find((t) => t.value === value);
          if (next) {
            void navigate(next.to);
          }
        }}
        className="mb-6"
      >
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-none sm:flex">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={isPersonal}
              className="sm:px-4"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : isError ? (
        <QueryErrorAlert
          error={error}
          isRefetching={isRefetching}
          onRetry={() => {
            void refetch();
          }}
          title="Couldn't load this house"
        />
      ) : isPersonal ? (
        <Alert>
          <InfoIcon className="size-4" />
          <AlertTitle>Personal house</AlertTitle>
          <AlertDescription>
            {activeTab === "members"
              ? "Members are only available for collaborative houses. Create a new house from the switcher above to invite teammates."
              : "House settings are only available for collaborative houses. Create a new house from the switcher above to manage settings."}
          </AlertDescription>
        </Alert>
      ) : (
        <Outlet context={{ organizationId: data.house.id } as const} />
      )}
    </main>
  );
}
