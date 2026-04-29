import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import { AppSidebar } from "~/lib/app-sidebar";
import { orpcUtils } from "~/lib/orpc-utils";
import { QueryErrorAlert } from "~/lib/query-error-alert";

export default function Component() {
  const { data, isPending, isError, error, isRefetching, refetch } = useQuery(
    orpcUtils.workspace.sync.queryOptions(),
  );

  if (isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <Spinner className="size-6" />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <QueryErrorAlert
          error={error}
          isRefetching={isRefetching}
          onRetry={() => {
            void refetch();
          }}
          title="Couldn't load this house"
          className="w-full max-w-md"
        />
      </main>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar houseName={data.house.name} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b border-border/60 px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <span className="min-w-0 truncate font-heading text-base text-foreground">
            {data.house.name}
          </span>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {data.workspace.isPersonal ? "Personal" : "Team"}
          </span>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
