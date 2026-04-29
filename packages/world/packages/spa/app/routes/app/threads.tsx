import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircleIcon,
  CircleDotIcon,
  MessageSquareIcon,
  PlusIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
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

const NONE_VALUE = "__none__";

function CreateThreadDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [assignedCatId, setAssignedCatId] = useState<string>(NONE_VALUE);
  const [goalId, setGoalId] = useState<string>(NONE_VALUE);
  const cats = useQuery(orpcUtils.cat.list.queryOptions());
  const goals = useQuery(orpcUtils.goal.list.queryOptions());
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpcUtils.thread.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.thread.list.queryKey(),
        });
        setOpen(false);
        setTitle("");
        setSummary("");
        setAssignedCatId(NONE_VALUE);
        setGoalId(NONE_VALUE);
      },
      onError: toastError,
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="size-4" />
          New thread
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a thread</DialogTitle>
          <DialogDescription>
            Threads are the durable work objects of the house.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({
              title: title.trim(),
              summary: summary.trim() || null,
              assignedCatId:
                assignedCatId === NONE_VALUE ? null : assignedCatId,
              goalId: goalId === NONE_VALUE ? null : goalId,
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="thread-title">Title</Label>
            <Input
              id="thread-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="thread-summary">Summary</Label>
            <Textarea
              id="thread-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Assign cat</Label>
              <Select value={assignedCatId} onValueChange={setAssignedCatId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Unassigned</SelectItem>
                  {cats.data?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Goal</Label>
              <Select value={goalId} onValueChange={setGoalId}>
                <SelectTrigger>
                  <SelectValue placeholder="No goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>No goal</SelectItem>
                  {goals.data?.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || title.trim().length === 0}
            >
              {mutation.isPending ? "Opening…" : "Open thread"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ThreadActions({
  threadId,
  status,
}: {
  threadId: string;
  status: string;
}) {
  const queryClient = useQueryClient();
  const close = useMutation(
    orpcUtils.thread.close.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.thread.list.queryKey(),
        });
      },
      onError: toastError,
    }),
  );
  const reopen = useMutation(
    orpcUtils.thread.reopen.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.thread.list.queryKey(),
        });
      },
      onError: toastError,
    }),
  );

  if (status === "open") {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={close.isPending}
        onClick={() => close.mutate({ id: threadId })}
      >
        <CheckCircleIcon className="size-4" />
        Close
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={reopen.isPending}
      onClick={() => reopen.mutate({ id: threadId })}
    >
      <RotateCcwIcon className="size-4" />
      Reopen
    </Button>
  );
}

export default function Component() {
  const threads = useQuery(orpcUtils.thread.list.queryOptions());
  const cats = useQuery(orpcUtils.cat.list.queryOptions());
  const catNameById = new Map(cats.data?.map((c) => [c.id, c.name]) ?? []);
  const canMutate = useCanMutate();

  return (
    <>
      <SectionHeader
        title="Threads"
        description="Durable work objects, with comments and assignments."
        action={canMutate ? <CreateThreadDialog /> : null}
      />
      <div className="px-6 py-6">
        {threads.data && threads.data.length > 0 ? (
          <div className="flex flex-col gap-3">
            {threads.data.map((thread) => (
              <Card key={thread.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-heading text-base">
                      {thread.title}
                    </CardTitle>
                    <Badge
                      variant={
                        thread.status === "open" ? "default" : "secondary"
                      }
                    >
                      {thread.status === "open" ? (
                        <CircleDotIcon className="size-3" />
                      ) : (
                        <CheckCircleIcon className="size-3" />
                      )}
                      {thread.status}
                    </Badge>
                  </div>
                  {thread.summary && (
                    <CardDescription>{thread.summary}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {thread.assignedCatId && (
                    <Badge variant="outline">
                      {catNameById.get(thread.assignedCatId) ?? "Cat"}
                    </Badge>
                  )}
                  {thread.goalId && (
                    <Badge variant="outline">Linked to a goal</Badge>
                  )}
                </CardContent>
                <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Updated {new Date(thread.updatedAt).toLocaleString()}
                  </span>
                  {canMutate && (
                    <ThreadActions
                      threadId={thread.id}
                      status={thread.status}
                    />
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MessageSquareIcon}
            title="No threads yet"
            description={
              canMutate
                ? "Open the first thread to start moving work through your house."
                : "An owner or admin will open the first thread soon."
            }
            action={canMutate ? <CreateThreadDialog /> : null}
          />
        )}
      </div>
    </>
  );
}
