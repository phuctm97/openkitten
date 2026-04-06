import { ThemeSwitcher } from "~/components/kibo-ui/theme-switcher";
import { Scene } from "~/components/scene";
import { Badge } from "~/components/ui/badge";
import { useTheme } from "~/lib/use-theme";

export default function Component() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      <header className="flex flex-col gap-5 rounded-[2rem] border border-border/60 bg-card/72 p-6 shadow-[0_28px_80px_-52px_rgba(249,115,22,0.5)] backdrop-blur-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Phase 1</Badge>
            <Badge variant="outline">React + Pixi</Badge>
          </div>
          <div className="space-y-2">
            <h1 className="m-0 font-heading text-[clamp(2.2rem,5vw,4.4rem)] leading-none">
              OpenKitten World
            </h1>
            <p className="m-0 max-w-[60ch] text-base leading-[1.65] text-muted-foreground">
              The home page is now a real browser-client demo: React Router
              drives shell, Jotai powers state, and a Pixi room sits at the
              center like a tiny screen inside the app.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className="m-0 font-mono text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
            Theme
          </p>
          <ThemeSwitcher value={theme} onChange={setTheme} />
        </div>
      </header>

      <Scene />
    </section>
  );
}
