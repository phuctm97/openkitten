import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, ScaleIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
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
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { EmptyState } from "~/lib/empty-state";
import { orpcUtils } from "~/lib/orpc-utils";
import { SectionHeader } from "~/lib/section-header";
import { toastError } from "~/lib/toast-error";
import { useCanMutate } from "~/lib/use-can-mutate";

function CreateRuleDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpcUtils.rule.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.rule.list.queryKey(),
        });
        setOpen(false);
        setTitle("");
        setBody("");
      },
      onError: toastError,
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="size-4" />
          New rule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a rule</DialogTitle>
          <DialogDescription>
            Rules are standing constraints or preferences for the house.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({ title: title.trim(), body: body.trim() });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-title">Title</Label>
            <Input
              id="rule-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-body">Rule</Label>
            <Textarea
              id="rule-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                title.trim().length === 0 ||
                body.trim().length === 0
              }
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RuleToggle({ ruleId, enabled }: { ruleId: string; enabled: boolean }) {
  const queryClient = useQueryClient();
  const update = useMutation(
    orpcUtils.rule.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.rule.list.queryKey(),
        });
      },
      onError: toastError,
    }),
  );

  return (
    <Switch
      checked={enabled}
      disabled={update.isPending}
      onCheckedChange={(value) => update.mutate({ id: ruleId, enabled: value })}
      aria-label={enabled ? "Disable rule" : "Enable rule"}
    />
  );
}

export default function Component() {
  const rules = useQuery(orpcUtils.rule.list.queryOptions());
  const canMutate = useCanMutate();

  return (
    <>
      <SectionHeader
        title="Rules"
        description="Standing constraints the house should respect."
        action={canMutate ? <CreateRuleDialog /> : null}
      />
      <div className="px-6 py-6">
        {rules.data && rules.data.length > 0 ? (
          <div className="flex flex-col gap-3">
            {rules.data.map((rule) => (
              <Card key={rule.id} className={rule.enabled ? "" : "opacity-60"}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-heading text-base">
                      {rule.title}
                    </CardTitle>
                    {canMutate ? (
                      <RuleToggle ruleId={rule.id} enabled={rule.enabled} />
                    ) : (
                      <Badge variant={rule.enabled ? "default" : "outline"}>
                        {rule.enabled ? "enabled" : "disabled"}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="whitespace-pre-line text-sm text-foreground">
                  {rule.body}
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground">
                  Updated {new Date(rule.updatedAt).toLocaleString()}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ScaleIcon}
            title="No rules yet"
            description={
              canMutate
                ? "Add your first rule so the house has consistent guardrails."
                : "An owner or admin will add the first rule soon."
            }
            action={canMutate ? <CreateRuleDialog /> : null}
          />
        )}
      </div>
    </>
  );
}
