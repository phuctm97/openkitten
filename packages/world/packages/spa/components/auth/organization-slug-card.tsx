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

export interface OrganizationSlugCardProps {
  organizationId: string;
}

export function OrganizationSlugCard({
  organizationId,
}: OrganizationSlugCardProps) {
  const queryOptions = getFullOrganizationQueryOptions(organizationId);
  const { data: organization } = useQuery(queryOptions);

  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (organization?.slug) setSlug(organization.slug);
  }, [organization?.slug]);

  const { mutate: updateOrganization, isPending } = useMutation({
    mutationKey: ["active-organization", "update", "slug"] as const,
    mutationFn: (input: { slug: string }) =>
      authClient.organization.update({
        organizationId,
        data: input,
        fetchOptions: { throw: true },
      }),
    onSuccess: async () => {
      toast.success("House slug updated");
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
    if (!slug.trim()) {
      setError("Slug is required");
      return;
    }
    updateOrganization({ slug: slug.trim() });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>House slug</CardTitle>
          <CardDescription>
            Lowercase URL identifier for your house.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <Label htmlFor="organization-slug-card-slug" className="sr-only">
                Slug
              </Label>
              <Input
                id="organization-slug-card-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setError(undefined);
                }}
                maxLength={48}
                disabled={isPending || !organization}
              />
              <FieldDescription>Use 48 characters at maximum.</FieldDescription>
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
