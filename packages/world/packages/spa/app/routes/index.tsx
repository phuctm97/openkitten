import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRightIcon,
  GamepadIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import { Link } from "react-router";
import { Spinner } from "~/components/ui/spinner";
import { UserButton } from "~/components/user/user-button";
import { AmbientHouseCanvas } from "~/lib/ambient-house-canvas";
import { AppModePreview } from "~/lib/app-mode-preview";
import { HouseAnchor } from "~/lib/house-anchor";
import { orpcUtils } from "~/lib/orpc-utils";
import { QueryErrorAlert } from "~/lib/query-error-alert";

export default function Component() {
  const { data, isPending, isError, error, isRefetching, refetch } = useQuery(
    orpcUtils.workspace.sync.queryOptions(),
  );

  if (isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <Spinner className="size-6" />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <QueryErrorAlert
          error={error}
          isRefetching={isRefetching}
          onRetry={() => {
            void refetch();
          }}
          title="Couldn't load this house"
          className="w-full max-w-md"
        />
      </main>
    );
  }

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,var(--accent)_0%,transparent_60%),radial-gradient(ellipse_40%_40%_at_50%_100%,var(--muted)_0%,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.18] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 -z-10 size-[28rem] rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -bottom-40 -z-10 size-[32rem] rounded-full bg-accent/40 blur-3xl"
      />

      <HouseAnchor />
      <UserButton
        size="icon"
        className="fixed top-4 right-[12.5rem] z-30 hidden shadow-xs ring-1 ring-foreground/10 sm:inline-flex"
      />

      <header className="relative z-10 flex flex-col items-center gap-4 px-6 pt-24 pb-8 text-center lg:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 font-mono text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
          <span className="size-1 rounded-full bg-primary" />
          OpenKitten World
        </span>
        <h1 className="font-heading text-[clamp(2rem,4vw,3.5rem)] leading-[1.05] tracking-tight text-foreground">
          Welcome home,{" "}
          <span className="italic text-muted-foreground">
            {data.house.name.replace(/['']s House$/, "")}.
          </span>
        </h1>
      </header>

      <section className="relative z-10 flex flex-1 items-start justify-center px-6 pb-12">
        <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-2 lg:gap-6">
          <Link
            to="/app"
            className="group relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:p-7"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
            <div className="relative flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground">
                <LayoutDashboardIcon className="size-3" />
                App mode
              </span>
              <ArrowUpRightIcon className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
            </div>
            <div className="relative flex flex-col gap-1">
              <span className="font-heading text-2xl text-foreground">
                Calm, async work.
              </span>
              <span className="text-sm text-muted-foreground">
                Inspect, steer, and review your cats and their work.
              </span>
            </div>
            <div className="relative h-[clamp(9rem,14vw,12rem)]">
              <AppModePreview />
            </div>
          </Link>

          <Link
            to="/game"
            className="group relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:p-7"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -left-24 size-64 rounded-full bg-accent/40 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
            <div className="relative flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground">
                <GamepadIcon className="size-3" />
                Game mode
              </span>
              <ArrowUpRightIcon className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
            </div>
            <div className="relative flex flex-col gap-1">
              <span className="font-heading text-2xl text-foreground">
                Visit a living place.
              </span>
              <span className="text-sm text-muted-foreground">
                Step inside the House and watch the cats live their day.
              </span>
            </div>
            <div className="relative h-[clamp(9rem,14vw,12rem)] overflow-hidden rounded-2xl border border-border/40 bg-muted/40">
              <AmbientHouseCanvas className="absolute inset-0" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/30 via-transparent to-transparent" />
            </div>
          </Link>
        </div>
      </section>

      <footer className="relative z-10 flex items-center justify-center gap-4 px-6 pb-8 font-mono text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground">
        <span>House &amp; Cats</span>
        <span className="size-1 rounded-full bg-muted-foreground/40" />
        <span>Async first</span>
        <span className="size-1 rounded-full bg-muted-foreground/40" />
        <span>Lived-in</span>
      </footer>
    </main>
  );
}
