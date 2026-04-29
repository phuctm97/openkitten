import { useMutation, useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Spinner } from "~/components/ui/spinner";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { listOrganizationsQueryOptions } from "~/lib/list-organizations-query-options";
import { revalidateAtom } from "~/lib/revalidate-atom";
import { toastError } from "~/lib/toast-error";
import { CreateOrganizationDialog } from "./create-organization-dialog";

export interface OrganizationSwitcherProps {
  className?: string;
}

export function OrganizationSwitcher({ className }: OrganizationSwitcherProps) {
  const { data: session } = authClient.useSession();
  const activeOrganizationId = session?.session.activeOrganizationId ?? null;
  const revalidate = useSetAtom(revalidateAtom);

  const { data: organizations, isLoading } = useQuery(
    listOrganizationsQueryOptions,
  );

  const { mutate: setActiveOrganization, isPending } = useMutation({
    mutationKey: ["active-organization", "setActive"] as const,
    mutationFn: (organizationId: string | null) =>
      authClient.organization.setActive({
        organizationId,
        fetchOptions: { throw: true },
      }),
    onSuccess: async () => {
      await revalidate();
    },
    onError: (error) => {
      toastError(error);
    },
  });

  const [createOpen, setCreateOpen] = useState(false);

  const activeOrganization =
    organizations?.find((org) => org.id === activeOrganizationId) ??
    organizations?.[0];

  const triggerLabel = activeOrganization?.name ?? "Loading...";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "min-w-48 justify-between gap-2 font-normal",
              className,
            )}
            disabled={isPending}
          >
            <span className="flex items-center gap-2 truncate">
              {(isLoading || isPending) && <Spinner />}
              <span className="truncate">{triggerLabel}</span>
            </span>
            <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Houses
          </DropdownMenuLabel>

          {organizations?.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onSelect={() => setActiveOrganization(org.id)}
              className="justify-between"
            >
              <span className="truncate">{org.name}</span>
              {org.id === activeOrganization?.id && (
                <CheckIcon className="size-4" />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <PlusIcon className="size-4 text-muted-foreground" />
            Create house
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}
