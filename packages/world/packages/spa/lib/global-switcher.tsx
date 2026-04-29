import { ModeSwitcher } from "~/lib/mode-switcher";
import { ThemeSwitcher } from "~/lib/theme-switcher";

export function GlobalSwitcher() {
  return (
    <div className="isolate fixed right-4 top-4 z-10 flex h-8 items-center rounded-full bg-card p-1 shadow-xs ring-1 ring-foreground/10">
      <ModeSwitcher />
      <span aria-hidden className="mx-1 h-4 w-px bg-foreground/10" />
      <ThemeSwitcher />
    </div>
  );
}
