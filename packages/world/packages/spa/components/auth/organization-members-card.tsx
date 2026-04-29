import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MailPlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "~/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import { listOrganizationMembersQueryOptions } from "~/lib/list-organization-members-query-options";
import { queryClient } from "~/lib/query-client";
import { toastError } from "~/lib/toast-error";
import { InviteMemberDialog } from "./invite-member-dialog";

export interface OrganizationMembersCardProps {
  organizationId: string;
}

type Role = "member" | "admin" | "owner";

const roleLabels: Record<Role, string> = {
  member: "Member",
  admin: "Admin",
  owner: "Owner",
};

const assignableRoles: Role[] = ["member", "admin"];

function isRole(value: string): value is Role {
  return value === "member" || value === "admin" || value === "owner";
}

function isAssignableRole(value: string): value is "member" | "admin" {
  return value === "member" || value === "admin";
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function OrganizationMembersCard({
  organizationId,
}: OrganizationMembersCardProps) {
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user.id;
  const queryOptions = listOrganizationMembersQueryOptions(organizationId);
  const { data, isLoading } = useQuery(queryOptions);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { mutate: updateMemberRole, isPending: roleUpdatePending } =
    useMutation({
      mutationKey: ["active-organization", "updateMemberRole"] as const,
      mutationFn: (input: { memberId: string; role: Role }) =>
        authClient.organization.updateMemberRole({
          ...input,
          fetchOptions: { throw: true },
        }),
      onSuccess: async () => {
        toast.success("Role updated");
        await queryClient.invalidateQueries({
          queryKey: queryOptions.queryKey,
        });
      },
      onError: (error) => {
        toastError(error);
      },
    });

  const { mutate: removeMember, isPending: removePending } = useMutation({
    mutationKey: ["active-organization", "removeMember"] as const,
    mutationFn: (memberIdOrEmail: string) =>
      authClient.organization.removeMember({
        memberIdOrEmail,
        fetchOptions: { throw: true },
      }),
    onSuccess: async () => {
      toast.success("Member removed");
      await queryClient.invalidateQueries({
        queryKey: queryOptions.queryKey,
      });
    },
    onError: (error) => {
      toastError(error);
    },
  });

  const members = data?.members ?? [];
  const mutating = roleUpdatePending || removePending;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Add or remove members and manage their roles.
            </CardDescription>
          </div>
          <Button onClick={() => setInviteOpen(true)} disabled={mutating}>
            <MailPlusIcon className="size-4" />
            Invite member
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : members.length === 0 ? (
            <Empty>
              <EmptyTitle>No members yet</EmptyTitle>
              <EmptyDescription>
                Invite teammates to start collaborating.
              </EmptyDescription>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="w-[160px]">Role</TableHead>
                  <TableHead className="w-[160px]">Joined</TableHead>
                  <TableHead className="w-[80px] text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isSelf = member.user.id === currentUserId;
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            {member.user.image && (
                              <AvatarImage
                                src={member.user.image}
                                alt={member.user.name}
                              />
                            )}
                            <AvatarFallback>
                              {initials(member.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {member.user.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {member.user.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={member.role}
                          onValueChange={(value) => {
                            if (isAssignableRole(value)) {
                              updateMemberRole({
                                memberId: member.id,
                                role: value,
                              });
                            }
                          }}
                          disabled={
                            mutating || isSelf || member.role === "owner"
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue>
                              {isRole(member.role)
                                ? roleLabels[member.role]
                                : member.role}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {assignableRoles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {roleLabels[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(member.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSelf && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={mutating}
                              >
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove member?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {member.user.name} will lose access to this
                                  house.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeMember(member.id)}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InviteMemberDialog
        organizationId={organizationId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </>
  );
}
