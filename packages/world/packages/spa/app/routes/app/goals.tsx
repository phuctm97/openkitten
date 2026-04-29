import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, PlusIcon, TargetIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
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

function CreateGoalDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpcUtils.goal.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.goal.list.queryKey(),
        });
        setOpen(false);
        setTitle("");
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
          New goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a goal</DialogTitle>
          <DialogDescription>
            Goals describe outcomes the house should pursue.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({
              title: title.trim(),
              description: description.trim() || null,
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ship the v1 launch"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-description">Description</Label>
            <Textarea
              id="goal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does success look like?"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || title.trim().length === 0}
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GoalActions({ goalId, status }: { goalId: string; status: string }) {
  const queryClient = useQueryClient();
  const update = useMutation(
    orpcUtils.goal.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.goal.list.queryKey(),
        });
      },
      onError: toastError,
    }),
  );

  if (status === "achieved") return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={update.isPending}
      onClick={() =>
        update.mutate({
          id: goalId,
          status: "achieved",
          achievedAt: new Date(),
        })
      }
    >
      <CheckCircle2Icon className="size-4" />
      Mark achieved
    </Button>
  );
}

export default function Component() {
  const goals = useQuery(orpcUtils.goal.list.queryOptions());
  const canMutate = useCanMutate();

  return (
    <>
      <SectionHeader
        title="Goals"
        description="Outcomes the cats and humans of this house are pursuing."
        action={canMutate ? <CreateGoalDialog /> : null}
      />
      <div className="px-6 py-6">
        {goals.data && goals.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {goals.data.map((goal) => (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-heading text-lg">
                      {goal.title}
                    </CardTitle>
                    <Badge
                      variant={
                        goal.status === "achieved" ? "secondary" : "default"
                      }
                    >
                      {goal.status}
                    </Badge>
                  </div>
                  {goal.description && (
                    <CardDescription>{goal.description}</CardDescription>
                  )}
                </CardHeader>
                <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {goal.achievedAt
                      ? `Achieved ${new Date(goal.achievedAt).toLocaleDateString()}`
                      : `Set ${new Date(goal.createdAt).toLocaleDateString()}`}
                  </span>
                  {canMutate && (
                    <GoalActions goalId={goal.id} status={goal.status} />
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={TargetIcon}
            title="No goals yet"
            description={
              canMutate
                ? "Set a goal to give the house something to pursue."
                : "An owner or admin will set the first goal soon."
            }
            action={canMutate ? <CreateGoalDialog /> : null}
          />
        )}
      </div>
    </>
  );
}
