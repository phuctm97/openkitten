import { useQuery } from "@tanstack/react-query";
import {
  CatIcon,
  InboxIcon,
  MessageSquareIcon,
  TargetIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { orpcUtils } from "~/lib/orpc-utils";

const formatter = new Intl.NumberFormat();

function Tile({
  icon: Icon,
  label,
  primary,
  secondary,
  loading,
}: {
  icon: typeof CatIcon;
  label: string;
  primary: number | null;
  secondary?: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-heading text-2xl leading-none">
          {loading || primary === null ? "—" : formatter.format(primary)}
        </span>
        {secondary && (
          <span className="text-xs text-muted-foreground">{secondary}</span>
        )}
      </div>
    </div>
  );
}

export function DashboardOverviewCard() {
  const cats = useQuery(orpcUtils.cat.list.queryOptions());
  const goals = useQuery(orpcUtils.goal.list.queryOptions());
  const threads = useQuery(orpcUtils.thread.list.queryOptions());
  const notices = useQuery(orpcUtils.notice.list.queryOptions());

  const openThreads = threads.data?.filter((t) => t.status === "open").length;
  const unreadNotices = notices.data?.filter((n) => n.readAt === null).length;
  const activeGoals = goals.data?.filter((g) => g.status === "active").length;

  return (
    <Card className="bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle>House at a glance</CardTitle>
        <CardDescription>
          What is moving inside your house right now.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Tile
          icon={CatIcon}
          label="Cats"
          primary={cats.data?.length ?? null}
          loading={cats.isPending}
        />
        <Tile
          icon={TargetIcon}
          label="Goals"
          primary={goals.data?.length ?? null}
          secondary={
            activeGoals !== undefined ? `${activeGoals} active` : undefined
          }
          loading={goals.isPending}
        />
        <Tile
          icon={MessageSquareIcon}
          label="Threads"
          primary={threads.data?.length ?? null}
          secondary={
            openThreads !== undefined ? `${openThreads} open` : undefined
          }
          loading={threads.isPending}
        />
        <Tile
          icon={InboxIcon}
          label="Inbox"
          primary={notices.data?.length ?? null}
          secondary={
            unreadNotices !== undefined ? `${unreadNotices} unread` : undefined
          }
          loading={notices.isPending}
        />
      </CardContent>
    </Card>
  );
}
