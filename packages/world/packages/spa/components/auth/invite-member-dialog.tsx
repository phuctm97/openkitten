import { useMutation } from "@tanstack/react-query";
import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { authClient } from "~/lib/auth-client";
import { queryClient } from "~/lib/query-client";
import { toastError } from "~/lib/toast-error";

export interface InviteMemberDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Role = "member" | "admin";

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

function isRole(value: string): value is Role {
  return value === "member" || value === "admin";
}

export function InviteMemberDialog({
  organizationId,
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);

  const { mutate: inviteMember, isPending } = useMutation({
    mutationKey: ["active-organization", "inviteMember"] as const,
    mutationFn: (input: {
      email: string;
      role: Role;
      organizationId: string;
    }) =>
      authClient.organization.inviteMember({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSuccess: async () => {
      toast.success("Invitation sent");
      await queryClient.invalidateQueries({
        queryKey: ["organizations", "invitations", organizationId],
      });
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toastError(error);
    },
  });

  const reset = () => {
    setEmail("");
    setRole("member");
    setEmailError(undefined);
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    inviteMember({ email: email.trim(), role, organizationId });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Invite a new member to join this house by email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={!!emailError}>
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(undefined);
                }}
                placeholder="teammate@example.com"
                required
                disabled={isPending}
              />
              <FieldError>{emailError}</FieldError>
            </Field>

            <Field>
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={role}
                onValueChange={(value) => {
                  if (isRole(value)) setRole(value);
                }}
                disabled={isPending}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Owners can manage the house; admins can manage members.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
