import { useMutation, useQuery } from "@tanstack/react-query";
import { type SyntheticEvent, useEffect, useState } from "react";
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
import { queryClient } from "~/lib/query-client";
import { toastError } from "~/lib/toast-error";

export interface OrganizationNameCardProps {
  organizationId: string;
}

export function OrganizationNameCard({
  organizationId,
}: OrganizationNameCardProps) {
  const queryOptions = getFullOrganizationQueryOptions(organizationId);
  const { data: organization } = useQuery(queryOptions);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (organization?.name) setName(organization.name);
  }, [organization?.name]);

  const { mutate: updateOrganization, isPending } = useMutation({
    mutationKey: ["active-organization", "update", "name"] as const,
    mutationFn: (input: { name: string }) =>
      authClient.organization.update({
        organizationId,
        data: input,
        fetchOptions: { throw: true },
      }),
    onSuccess: async () => {
      toast.success("House name updated");
      await queryClient.invalidateQueries({
        queryKey: ["organizations"],
      });
    },
    onError: (err) => {
      toastError(err);
    },
  });

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    updateOrganization({ name: name.trim() });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>House name</CardTitle>
          <CardDescription>The visible name of your house.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <Label htmlFor="organization-name-card-name" className="sr-only">
                Name
              </Label>
              <Input
                id="organization-name-card-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(undefined);
                }}
                maxLength={32}
                disabled={isPending || !organization}
              />
              <FieldDescription>Use 32 characters at maximum.</FieldDescription>
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isPending || !organization}>
            {isPending && <Spinner />}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
