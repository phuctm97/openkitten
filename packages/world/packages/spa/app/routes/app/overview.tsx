import { useQuery } from "@tanstack/react-query";
import {
  CatIcon,
  CircleDotIcon,
  CompassIcon,
  InboxIcon,
  MessageSquareIcon,
  MoonStarIcon,
  NotebookPenIcon,
  PinIcon,
  PlusIcon,
  SunIcon,
  TargetIcon,
} from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CatAvatar } from "~/lib/cat-avatar";
import { orpcUtils } from "~/lib/orpc-utils";
import { SectionCard } from "~/lib/section-card";
import { useCanMutate } from "~/lib/use-can-mutate";

const dayPart = (() => {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Goodnight";
})();

const todayLabel = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function relativeTime(value: Date) {
  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function EmptyRow({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: typeof CatIcon;
  title: string;
  hint: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-8 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="font-heading text-sm text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      {action && (
        <Button asChild size="sm" variant="ghost" className="mt-1">
          <Link to={action.to}>
            <PlusIcon className="size-3.5" />
            {action.label}
          </Link>
        </Button>
      )}
    </div>
  );
}

export default function Component() {
  const workspace = useQuery(orpcUtils.workspace.sync.queryOptions()).data;
  const activeMember = workspace?.members.find(
    (m) => m.id === workspace.activeMember.id,
  );
  const userName = activeMember?.user.name.split(/\s+/)[0];

  const cats = useQuery(orpcUtils.cat.list.queryOptions());
  const goals = useQuery(orpcUtils.goal.list.queryOptions());
  const threads = useQuery(orpcUtils.thread.list.queryOptions());
  const notices = useQuery(orpcUtils.notice.list.queryOptions());
  const memos = useQuery(orpcUtils.memo.list.queryOptions());

  const catsData = cats.data ?? [];
  const goalsData = goals.data ?? [];
  const threadsData = threads.data ?? [];
  const noticesData = notices.data ?? [];
  const memosData = memos.data ?? [];

  const unreadNotices = noticesData.filter((n) => n.readAt === null);
  const openThreads = threadsData.filter((t) => t.status === "open");
  const activeGoals = goalsData.filter((g) => g.status === "active");
  const pinnedMemos = memosData.filter((m) => m.pinnedAt !== null);

  const inboxItems = (
    unreadNotices.length > 0 ? unreadNotices : noticesData
  ).slice(0, 4);
  const threadItems = (
    openThreads.length > 0 ? openThreads : threadsData
  ).slice(0, 3);
  const memoItems = (pinnedMemos.length > 0 ? pinnedMemos : memosData).slice(
    0,
    2,
  );
  const goalItems = (activeGoals.length > 0 ? activeGoals : goalsData).slice(
    0,
    3,
  );
  const catItems = catsData.slice(0, 5);
  const catNameById = new Map(catsData.map((c) => [c.id, c.name]));
  const canMutate = useCanMutate();

  return (
    <div className="relative isolate flex-1 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_40%_at_50%_0%,var(--accent)_0%,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.12] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />

      <header className="px-6 py-8 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground">
              {todayLabel}
            </span>
            <h1 className="font-heading text-3xl tracking-tight text-foreground lg:text-4xl">
              {dayPart}
              {userName && (
                <>
                  ,{" "}
                  <span className="italic text-muted-foreground">
                    {userName}.
                  </span>
                </>
              )}
            </h1>
            <p className="max-w-lg text-sm text-muted-foreground">
              {canMutate
                ? "Observe the house, nudge where it matters, then let the cats carry the work."
                : "Read along while the owners and admins steer this house."}
            </p>
          </div>
          {canMutate && (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/app/threads">
                  <PlusIcon className="size-3.5" />
                  Open thread
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/app/memos">
                  <NotebookPenIcon className="size-3.5" />
                  Write memo
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/app/goals">
                  <TargetIcon className="size-3.5" />
                  Set goal
                </Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-5 px-6 pb-10 lg:grid-cols-3 lg:gap-6 lg:px-10 lg:pb-12">
        <SectionCard
          icon={InboxIcon}
          label="Inbox"
          meta={
            unreadNotices.length > 0
              ? `${unreadNotices.length} unread`
              : noticesData.length > 0
                ? "all caught up"
                : undefined
          }
          to="/app/inbox"
          className="lg:col-span-2"
        >
          {inboxItems.length === 0 ? (
            <EmptyRow
              icon={InboxIcon}
              title="The house is quiet."
              hint="Notices land here when something needs your attention."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {inboxItems.map((notice) => (
                <li key={notice.id} className="flex items-start gap-3 py-3">
                  <span className="mt-1.5 flex size-2 shrink-0 items-center justify-center">
                    {notice.readAt === null ? (
                      <span className="size-2 rounded-full bg-primary" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-foreground">
                        {notice.subject}
                      </span>
                      <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                        {relativeTime(notice.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-mono uppercase">
                        {notice.kind}
                      </Badge>
                      {notice.body && (
                        <span className="truncate">{notice.body}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          icon={CatIcon}
          label="Cats"
          meta={
            catsData.length > 0 ? `${catsData.length} in residence` : undefined
          }
          to="/app/cats"
        >
          {catItems.length === 0 ? (
            <EmptyRow
              icon={CatIcon}
              title="An empty house."
              hint="Adopt your first cat to start populating your house."
              action={
                canMutate ? { to: "/app/cats", label: "Adopt cat" } : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {catItems.map((cat) => (
                <li key={cat.id} className="flex items-center gap-3">
                  <CatAvatar cat={cat} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm text-foreground">
                      {cat.name}
                    </span>
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                      {cat.isResting ? "resting" : "awake"}
                    </span>
                  </div>
                  {cat.isResting ? (
                    <MoonStarIcon className="size-3.5 text-muted-foreground" />
                  ) : (
                    <SunIcon className="size-3.5 text-muted-foreground" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          icon={MessageSquareIcon}
          label="Active work"
          meta={
            openThreads.length > 0
              ? `${openThreads.length} open`
              : threadsData.length > 0
                ? "all closed"
                : undefined
          }
          to="/app/threads"
          className="lg:col-span-2"
        >
          {threadItems.length === 0 ? (
            <EmptyRow
              icon={MessageSquareIcon}
              title="No threads yet."
              hint="Threads carry durable work and comments."
              action={
                canMutate
                  ? { to: "/app/threads", label: "Open thread" }
                  : undefined
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {threadItems.map((thread) => (
                <li key={thread.id} className="flex items-start gap-3 py-3">
                  <CircleDotIcon
                    className={
                      thread.status === "open"
                        ? "mt-0.5 size-3.5 shrink-0 text-primary"
                        : "mt-0.5 size-3.5 shrink-0 text-muted-foreground/60"
                    }
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-foreground">
                        {thread.title}
                      </span>
                      <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                        {relativeTime(thread.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {thread.assignedCatId &&
                        catNameById.has(thread.assignedCatId) && (
                          <Badge
                            variant="outline"
                            className="font-mono uppercase"
                          >
                            {catNameById.get(thread.assignedCatId)}
                          </Badge>
                        )}
                      {thread.summary && (
                        <span className="truncate">{thread.summary}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="flex flex-col gap-5 lg:gap-6">
          <SectionCard
            icon={CompassIcon}
            label="Direction"
            meta={
              activeGoals.length > 0
                ? `${activeGoals.length} active`
                : undefined
            }
            to="/app/goals"
          >
            {goalItems.length === 0 ? (
              <EmptyRow
                icon={TargetIcon}
                title="No goals yet."
                hint="Set a goal to give the house something to pursue."
                action={
                  canMutate
                    ? { to: "/app/goals", label: "Set goal" }
                    : undefined
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {goalItems.map((goal) => (
                  <li key={goal.id} className="flex items-start gap-3">
                    <TargetIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm text-foreground">
                        {goal.title}
                      </span>
                      <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                        {goal.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            icon={NotebookPenIcon}
            label="Steering"
            meta={
              pinnedMemos.length > 0
                ? `${pinnedMemos.length} pinned`
                : memosData.length > 0
                  ? `${memosData.length} memo${memosData.length === 1 ? "" : "s"}`
                  : undefined
            }
            to="/app/memos"
          >
            {memoItems.length === 0 ? (
              <EmptyRow
                icon={NotebookPenIcon}
                title="No memos yet."
                hint="Memos steer cats over time."
                action={
                  canMutate
                    ? { to: "/app/memos", label: "Write memo" }
                    : undefined
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {memoItems.map((memo) => (
                  <li key={memo.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {memo.pinnedAt && (
                        <PinIcon className="size-3 text-primary" />
                      )}
                      <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                        {memo.targetCatId && catNameById.has(memo.targetCatId)
                          ? catNameById.get(memo.targetCatId)
                          : "Whole house"}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-foreground">
                      {memo.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
