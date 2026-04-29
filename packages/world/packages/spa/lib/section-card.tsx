import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/cn";

export function SectionCard({
  className,
  icon: Icon,
  label,
  meta,
  to,
  children,
}: {
  className?: string;
  icon: LucideIcon;
  label: string;
  meta?: string;
  to: string;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-5 shadow-xs ring-1 ring-foreground/5 backdrop-blur-sm lg:p-6",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-3.5" />
          </span>
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </span>
          {meta && (
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-foreground/70">
              · {meta}
            </span>
          )}
        </div>
        <Link
          to={to}
          className="group/see flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
        >
          See all
          <ArrowRightIcon className="size-3 transition-transform group-hover/see:translate-x-0.5" />
        </Link>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </article>
  );
}
