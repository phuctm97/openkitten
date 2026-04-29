import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheckIcon, CircleIcon, InboxIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { EmptyState } from "~/lib/empty-state";
import { orpcUtils } from "~/lib/orpc-utils";
import { SectionHeader } from "~/lib/section-header";
import { toastError } from "~/lib/toast-error";
import { useCanMutate } from "~/lib/use-can-mutate";

export default function Component() {
  const notices = useQuery(orpcUtils.notice.list.queryOptions());
  const queryClient = useQueryClient();
  const canMutate = useCanMutate();

  const markRead = useMutation(
    orpcUtils.notice.markRead.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.notice.list.queryKey(),
        });
      },
      onError: toastError,
    }),
  );

  const markAllRead = useMutation(
    orpcUtils.notice.markAllRead.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpcUtils.notice.list.queryKey(),
        });
      },
      onError: toastError,
    }),
  );

  const hasUnread = notices.data?.some((n) => n.readAt === null);

  return (
    <>
      <SectionHeader
        title="Inbox"
        description="Calm signals from your house. Review, then act."
        action={
          canMutate && hasUnread ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => markAllRead.mutate({})}
              disabled={markAllRead.isPending}
            >
              <CheckCheckIcon className="size-4" />
              Mark all read
            </Button>
          ) : null
        }
      />
      <div className="px-6 py-6">
        {notices.data && notices.data.length > 0 ? (
          <div className="flex flex-col gap-3">
            {notices.data.map((notice) => (
              <Card key={notice.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {notice.readAt === null && (
                        <CircleIcon className="size-2.5 fill-current text-primary" />
                      )}
                      <CardTitle className="font-heading text-base">
                        {notice.subject}
                      </CardTitle>
                    </div>
                    <Badge variant="outline">{notice.kind}</Badge>
                  </div>
                  {notice.body && (
                    <CardDescription>{notice.body}</CardDescription>
                  )}
                </CardHeader>
                <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{new Date(notice.createdAt).toLocaleString()}</span>
                  {canMutate && notice.readAt === null && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markRead.mutate({ id: notice.id })}
                      disabled={markRead.isPending}
                    >
                      Mark read
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={InboxIcon}
            title="Inbox zero"
            description="Notices appear here when something needs your attention."
          />
        )}
      </div>
    </>
  );
}
