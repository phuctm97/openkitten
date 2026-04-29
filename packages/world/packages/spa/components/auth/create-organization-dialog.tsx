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
import { Spinner } from "~/components/ui/spinner";
import { authClient } from "~/lib/auth-client";
import { queryClient } from "~/lib/query-client";
import { toastError } from "~/lib/toast-error";

export interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});

  const { mutate: createOrganization, isPending } = useMutation({
    mutationKey: ["organizations", "create"] as const,
    mutationFn: async (input: { name: string; slug: string }) => {
      return authClient.organization.create({
        ...input,
        fetchOptions: { throw: true },
      });
    },
    onSuccess: async () => {
      toast.success("House created");
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toastError(error);
    },
  });

  const reset = () => {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setErrors({});
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
    setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugTouched(true);
    setErrors((prev) => ({ ...prev, slug: undefined }));
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: { name?: string; slug?: string } = {};
    if (!name.trim()) nextErrors.name = "Name is required";
    if (!slug.trim()) nextErrors.slug = "Slug is required";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    createOrganization({ name: name.trim(), slug: slug.trim() });
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
          <DialogTitle>Create house</DialogTitle>
          <DialogDescription>
            Houses let you collaborate with others on shared work.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <Label htmlFor="organization-name">Name</Label>
              <Input
                id="organization-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Co"
                maxLength={32}
                required
                disabled={isPending}
              />
              <FieldDescription>
                The visible name of your house.
              </FieldDescription>
              <FieldError>{errors.name}</FieldError>
            </Field>

            <Field data-invalid={!!errors.slug}>
              <Label htmlFor="organization-slug">Slug</Label>
              <Input
                id="organization-slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="acme"
                maxLength={48}
                required
                disabled={isPending}
              />
              <FieldDescription>
                Lowercase URL identifier for the house.
              </FieldDescription>
              <FieldError>{errors.slug}</FieldError>
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
              Create house
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
