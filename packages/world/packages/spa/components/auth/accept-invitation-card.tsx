import { useMutation, useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { getInvitationQueryOptions } from "~/lib/get-invitation-query-options";
import { navigateAtom } from "~/lib/navigate-atom";
import { queryClient } from "~/lib/query-client";
import { toastError } from "~/lib/toast-error";

export interface AcceptInvitationCardProps {
  invitationId: string;
  className?: string;
}

export function AcceptInvitationCard({
  invitationId,
  className,
}: AcceptInvitationCardProps) {
  const navigate = useSetAtom(navigateAtom);
  const queryOptions = getInvitationQueryOptions(invitationId);
  const {
    data: invitation,
    isLoading,
    isError,
    error,
  } = useQuery(queryOptions);

  const { mutate: acceptInvitation, isPending: acceptPending } = useMutation({
    mutationKey: ["active-organization", "acceptInvitation"] as const,
    mutationFn: () =>
      authClient.organization.acceptInvitation({
        invitationId,
        fetchOptions: { throw: true },
      }),
    onSuccess: async () => {
      toast.success("Invitation accepted");
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      await navigate("/", { wait: true });
    },
    onError: (err) => {
      toastError(err);
    },
  });

  const { mutate: rejectInvitation, isPending: rejectPending } = useMutation({
    mutationKey: ["active-organization", "rejectInvitation"] as const,
    mutationFn: () =>
      authClient.organization.rejectInvitation({
        invitationId,
        fetchOptions: { throw: true },
      }),
    onSuccess: async () => {
      toast.success("Invitation declined");
      await navigate("/", { wait: true });
    },
    onError: (err) => {
      toastError(err);
    },
  });

  if (isLoading) {
    return (
      <Card className={cn("w-full max-w-md", className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  if (isError || !invitation) {
    return (
      <Card className={cn("w-full max-w-md", className)}>
        <CardHeader>
          <CardTitle>Invitation unavailable</CardTitle>
          <CardDescription>
            {error?.message ??
              "This invitation may have expired or been revoked."}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={() => navigate("/")}>
            Go home
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const pending = acceptPending || rejectPending;

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader>
        <CardTitle>You're invited</CardTitle>
        <CardDescription>
          You have been invited to join{" "}
          <span className="font-medium text-foreground">
            {invitation.organizationName}
          </span>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Accepting this invitation will switch your active house to{" "}
        {invitation.organizationName}.
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => rejectInvitation()}
          disabled={pending}
        >
          {rejectPending && <Spinner />}
          Decline
        </Button>
        <Button onClick={() => acceptInvitation()} disabled={pending}>
          {acceptPending && <Spinner />}
          Accept
        </Button>
      </CardFooter>
    </Card>
  );
}
