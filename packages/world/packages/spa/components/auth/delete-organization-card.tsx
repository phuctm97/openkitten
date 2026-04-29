import { useMutation, useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { type SyntheticEvent, useState } from "react";
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
import { Spinner } from "~/components/ui/spinner";
import { authClient } from "~/lib/auth-client";
import { getFullOrganizationQueryOptions } from "~/lib/get-full-organization-query-options";
import { navigateAtom } from "~/lib/navigate-atom";
import { queryClient } from "~/lib/query-client";
import { toastError } from "~/lib/toast-error";

export interface DeleteOrganizationCardProps {
  organizationId: string;
}

export function DeleteOrganizationCard({
  organizationId,
}: DeleteOrganizationCardProps) {
  const { data: organization } = useQuery(
    getFullOrganizationQueryOptions(organizationId),
  );
  const navigate = useSetAtom(navigateAtom);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [confirmError, setConfirmError] = useState<string | undefined>(
    undefined,
  );

  const { mutate: deleteOrganization, isPending } = useMutation({
    mutationKey: ["active-organization", "delete"] as const,
    mutationFn: () =>
      authClient.organization.delete({
        organizationId,
        fetchOptions: { throw: true },
      }),
    onSuccess: async () => {
      toast.success("House deleted");
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setConfirmOpen(false);
      await navigate("/", { wait: true });
    },
    onError: (error) => {
      toastError(error);
    },
  });

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmInput.trim() !== organization?.slug) {
      setConfirmError("Slug does not match");
      return;
    }
    deleteOrganization();
  };

  return (
    <>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete house</CardTitle>
          <CardDescription>
            Permanently remove this house and all of its contents. This action
            is not reversible.
          </CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="justify-end">
          <Button
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={!organization}
          >
            Delete house
          </Button>
        </CardFooter>
      </Card>

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (!next) {
            setConfirmInput("");
            setConfirmError(undefined);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete house</DialogTitle>
            <DialogDescription>
              This action cannot be undone. To confirm, type the house slug{" "}
              <span className="font-mono font-medium">
                {organization?.slug}
              </span>{" "}
              below.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field data-invalid={!!confirmError}>
                <Label htmlFor="delete-confirm">House slug</Label>
                <Input
                  id="delete-confirm"
                  value={confirmInput}
                  onChange={(e) => {
                    setConfirmInput(e.target.value);
                    setConfirmError(undefined);
                  }}
                  autoComplete="off"
                  disabled={isPending}
                />
                <FieldDescription>
                  This must match exactly to confirm deletion.
                </FieldDescription>
                <FieldError>{confirmError}</FieldError>
              </Field>
            </FieldGroup>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending && <Spinner />}
                Delete house
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
