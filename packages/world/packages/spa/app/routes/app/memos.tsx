import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPenIcon, PinIcon, PinOffIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
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
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { EmptyState } from "~/lib/empty-state";
import { orpcUtils } from "~/lib/orpc-utils";
import { SectionHeader } from "~/lib/section-header";
import { toastError } from "~/lib/toast-error";
import { useCanMutate } from "~/lib/use-can-mutate";

const HOUSE_VALUE = "__house__";

function CreateMemoDialog() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [targetCatId, setTargetCatId] = useState<string>(HOUSE_VALUE);
  const cats = useQuery(orpcUtils.cat.list.queryOptions());
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpcUtils.memo.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.memo.list.queryKey(),
        });
        setOpen(false);
        setBody("");
        setTargetCatId(HOUSE_VALUE);
      },
      onError: toastError,
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="size-4" />
          Write memo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Write a memo</DialogTitle>
          <DialogDescription>
            Memos steer cats. Pinned memos surface to the top.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({
              body: body.trim(),
              targetCatId: targetCatId === HOUSE_VALUE ? null : targetCatId,
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="memo-body">Memo</Label>
            <Textarea
              id="memo-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Target</Label>
            <Select value={targetCatId} onValueChange={setTargetCatId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={HOUSE_VALUE}>Whole house</SelectItem>
                {cats.data?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || body.trim().length === 0}
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemoPinButton({
  memoId,
  pinnedAt,
}: {
  memoId: string;
  pinnedAt: Date | null;
}) {
  const queryClient = useQueryClient();
  const pin = useMutation(
    orpcUtils.memo.pin.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.memo.list.queryKey(),
        });
      },
      onError: toastError,
    }),
  );
  const unpin = useMutation(
    orpcUtils.memo.unpin.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.memo.list.queryKey(),
        });
      },
      onError: toastError,
    }),
  );

  if (pinnedAt) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => unpin.mutate({ id: memoId })}
        disabled={unpin.isPending}
      >
        <PinOffIcon className="size-4" />
        Unpin
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => pin.mutate({ id: memoId })}
      disabled={pin.isPending}
    >
      <PinIcon className="size-4" />
      Pin
    </Button>
  );
}

export default function Component() {
  const memos = useQuery(orpcUtils.memo.list.queryOptions());
  const cats = useQuery(orpcUtils.cat.list.queryOptions());
  const catNameById = new Map(cats.data?.map((c) => [c.id, c.name]) ?? []);
  const canMutate = useCanMutate();

  return (
    <>
      <SectionHeader
        title="Memos"
        description="Steering notes for cats and the house."
        action={canMutate ? <CreateMemoDialog /> : null}
      />
      <div className="px-6 py-6">
        {memos.data && memos.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {memos.data.map((memo) => (
              <Card key={memo.id}>
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {memo.pinnedAt && (
                      <Badge variant="default">
                        <PinIcon className="size-3" />
                        Pinned
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {memo.targetCatId
                        ? (catNameById.get(memo.targetCatId) ?? "Cat")
                        : "Whole house"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="whitespace-pre-line text-sm text-foreground">
                  {memo.body}
                </CardContent>
                <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{new Date(memo.createdAt).toLocaleString()}</span>
                  {canMutate && (
                    <MemoPinButton memoId={memo.id} pinnedAt={memo.pinnedAt} />
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={NotebookPenIcon}
            title="No memos yet"
            description={
              canMutate
                ? "Memos are how you steer the cats over time."
                : "An owner or admin will add the first memo soon."
            }
            action={canMutate ? <CreateMemoDialog /> : null}
          />
        )}
      </div>
    </>
  );
}
