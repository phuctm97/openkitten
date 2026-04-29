import { useQuery } from "@tanstack/react-query";
import {
  CatIcon,
  InboxIcon,
  type LucideIcon,
  MessageSquareIcon,
  TargetIcon,
} from "lucide-react";
import { orpcUtils } from "~/lib/orpc-utils";

function Tile({
  icon: Icon,
  label,
  primary,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  primary: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/70 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-3xl leading-none text-foreground">
          {primary}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

export function AppModePreview() {
  const cats = useQuery(orpcUtils.cat.list.queryOptions());
  const goals = useQuery(orpcUtils.goal.list.queryOptions());
  const threads = useQuery(orpcUtils.thread.list.queryOptions());
  const notices = useQuery(orpcUtils.notice.list.queryOptions());

  const catCount = cats.data?.length ?? 0;
  const activeGoals =
    goals.data?.filter((g) => g.status === "active").length ?? 0;
  const openThreads =
    threads.data?.filter((t) => t.status === "open").length ?? 0;
  const unreadNotices =
    notices.data?.filter((n) => n.readAt === null).length ?? 0;

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      <Tile
        icon={CatIcon}
        label="Cats"
        primary={String(catCount)}
        hint="in residence"
      />
      <Tile
        icon={TargetIcon}
        label="Goals"
        primary={String(activeGoals)}
        hint="active"
      />
      <Tile
        icon={MessageSquareIcon}
        label="Threads"
        primary={String(openThreads)}
        hint="open"
      />
      <Tile
        icon={InboxIcon}
        label="Inbox"
        primary={String(unreadNotices)}
        hint="unread"
      />
    </div>
  );
}
