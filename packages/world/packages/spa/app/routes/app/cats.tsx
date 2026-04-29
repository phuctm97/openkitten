import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CatIcon, MoonStarIcon, PlusIcon, SunIcon } from "lucide-react";
import { useState } from "react";
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
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { EmptyState } from "~/lib/empty-state";
import { orpcUtils } from "~/lib/orpc-utils";
import { SectionHeader } from "~/lib/section-header";
import { toastError } from "~/lib/toast-error";
import { useCanMutate } from "~/lib/use-can-mutate";

function CreateCatDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpcUtils.cat.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.cat.list.queryKey(),
        });
        setOpen(false);
        setName("");
        setDescription("");
      },
      onError: toastError,
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="size-4" />
          Adopt cat
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adopt a cat</DialogTitle>
          <DialogDescription>
            Cats are the workers in your house. Give yours a name to start.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({
              name: name.trim(),
              description: description.trim() || null,
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Misty"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-description">Description</Label>
            <Textarea
              id="cat-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this cat focuses on, how it works…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || name.trim().length === 0}
            >
              {mutation.isPending ? "Adopting…" : "Adopt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Component() {
  const cats = useQuery(orpcUtils.cat.list.queryOptions());
  const canMutate = useCanMutate();

  return (
    <>
      <SectionHeader
        title="Cats"
        description="Persistent workers that live in this house."
        action={canMutate ? <CreateCatDialog /> : null}
      />
      <div className="px-6 py-6">
        {cats.data && cats.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cats.data.map((cat) => (
              <Card key={cat.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-heading text-lg">
                      {cat.name}
                    </CardTitle>
                    {cat.isResting ? (
                      <MoonStarIcon className="size-4 text-muted-foreground" />
                    ) : (
                      <SunIcon className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <CardDescription>{cat.slug}</CardDescription>
                </CardHeader>
                {cat.description && (
                  <CardContent className="text-sm text-muted-foreground">
                    {cat.description}
                  </CardContent>
                )}
                <CardFooter className="text-xs text-muted-foreground">
                  Adopted {new Date(cat.createdAt).toLocaleDateString()}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CatIcon}
            title="No cats yet"
            description={
              canMutate
                ? "Adopt your first cat to start populating your house."
                : "An owner or admin will adopt the first cat soon."
            }
            action={canMutate ? <CreateCatDialog /> : null}
          />
        )}
      </div>
    </>
  );
}
