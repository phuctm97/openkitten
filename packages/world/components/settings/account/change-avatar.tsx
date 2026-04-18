import { useAuth, useSession, useUpdateUser } from "@better-auth-ui/react";
import { fileToBase64 } from "@better-auth-ui/react/core";
import { Trash2, Upload } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Field } from "~/components/ui/field";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { UserAvatar } from "~/components/user/user-avatar";
import { toastAuthError } from "~/lib/auth-errors";

export type ChangeAvatarProps = {
  className?: string;
};

export function ChangeAvatar({ className }: ChangeAvatarProps) {
  const { localization, avatar } = useAuth();
  const { data: session } = useSession();

  const { mutate: updateUser, isPending: updatePending } = useUpdateUser({
    onError: toastAuthError,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPending = updatePending || isUploading || isDeleting;
  const currentImage = session?.user.image ?? undefined;

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    setIsUploading(true);

    try {
      const resized =
        (await avatar.resize?.(file, avatar.size, avatar.extension)) || file;

      const image =
        (await avatar.upload?.(resized)) || (await fileToBase64(resized));

      updateUser(
        { image },
        {
          onSuccess: () =>
            toast.success(localization.settings.avatarChangedSuccess),
        },
      );
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }

    setIsUploading(false);
  }

  async function handleDelete(currentImage: string) {
    updateUser(
      { image: null },
      {
        onSuccess: async () => {
          setIsDeleting(true);
          try {
            await avatar.delete?.(currentImage);
          } finally {
            setIsDeleting(false);
          }

          toast.success(localization.settings.avatarDeletedSuccess);
        },
      },
    );
  }

  return (
    <Field className={className}>
      <Label>{localization.settings.avatar}</Label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          className="p-0 h-auto w-auto rounded-full"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <UserAvatar className="size-12" isPending={isPending} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              disabled={!session || isPending}
            >
              {isPending && <Spinner />}

              {localization.settings.changeAvatar}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="min-w-fit">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload className="text-muted-foreground" />

              {localization.settings.uploadAvatar}
            </DropdownMenuItem>

            <DropdownMenuItem
              variant="destructive"
              disabled={!currentImage}
              onClick={
                currentImage ? () => handleDelete(currentImage) : undefined
              }
            >
              <Trash2 />

              {localization.settings.deleteAvatar}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Field>
  );
}
