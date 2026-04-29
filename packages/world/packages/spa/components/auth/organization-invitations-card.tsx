import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { authClient } from "~/lib/auth-client";
import { listOrganizationInvitationsQueryOptions } from "~/lib/list-organization-invitations-query-options";
import { queryClient } from "~/lib/query-client";
import { toastError } from "~/lib/toast-error";

export interface OrganizationInvitationsCardProps {
  organizationId: string;
}

export function OrganizationInvitationsCard({
  organizationId,
}: OrganizationInvitationsCardProps) {
  const queryOptions = listOrganizationInvitationsQueryOptions(organizationId);
  const { data: invitations, isLoading } = useQuery(queryOptions);

  const { mutate: cancelInvitation, isPending } = useMutation({
    mutationKey: ["active-organization", "cancelInvitation"] as const,
    mutationFn: (invitationId: string) =>
      authClient.organization.cancelInvitation({
        invitationId,
        fetchOptions: { throw: true },
      }),
    onSuccess: async () => {
      toast.success("Invitation canceled");
      await queryClient.invalidateQueries({
        queryKey: queryOptions.queryKey,
      });
    },
    onError: (error) => {
      toastError(error);
    },
  });

  const pendingInvitations =
    invitations?.filter((invite) => invite.status === "pending") ?? [];

  if (!isLoading && pendingInvitations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
        <CardDescription>
          Manage outstanding invitations to your house.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="w-[120px]">Role</TableHead>
                <TableHead className="w-[160px]">Expires</TableHead>
                <TableHead className="w-[120px] text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingInvitations.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{invite.role ?? "member"}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelInvitation(invite.id)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
