import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/60 px-6 py-5 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-2xl text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </header>
  );
}
