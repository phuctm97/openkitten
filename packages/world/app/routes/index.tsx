import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { useTheme } from "~/lib/use-theme";

export default function Component() {
  const { theme, setTheme, colorScheme } = useTheme();

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-8 text-card-foreground shadow-xl shadow-primary/5">
        <Badge variant="outline" className="mb-3">
          House
        </Badge>
        <h2 className="mb-4 mt-0 font-heading text-[clamp(1.6rem,2.8vw,2.4rem)] leading-[1.1]">
          House Route Placeholder
        </h2>
        <p className="m-0 max-w-[64ch] text-base leading-[1.6]">
          This route will eventually become the first playable House slice with
          cats, notices, threads, and an active session view.
        </p>
      </div>

      <article className="space-y-6 rounded-3xl border border-border bg-card/90 p-8 text-card-foreground shadow-xl shadow-primary/5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary">Theme</Badge>
            <h2 className="m-0 font-heading text-[clamp(1.6rem,2.8vw,2.4rem)] leading-[1.1]">
              Tune the House for day, night, or whatever your system prefers.
            </h2>
            <p className="m-0 max-w-[64ch] text-base leading-[1.6] text-muted-foreground">
              OpenKitten World keeps your theme in local storage so the House
              feels familiar every time you come back.
            </p>
          </div>

          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Theme preference</legend>
            <Button
              type="button"
              aria-pressed={theme === "auto"}
              variant={theme === "auto" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTheme("auto");
              }}
            >
              Auto
            </Button>
            <Button
              type="button"
              aria-pressed={theme === "light"}
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTheme("light");
              }}
            >
              Light
            </Button>
            <Button
              type="button"
              aria-pressed={theme === "dark"}
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTheme("dark");
              }}
            >
              Dark
            </Button>
          </fieldset>
        </div>

        <Separator />

        <div className="grid gap-3 rounded-2xl border border-border bg-muted/60 p-4 font-mono text-sm leading-6 text-muted-foreground sm:grid-cols-2">
          <p className="m-0">
            <span className="font-semibold text-foreground">theme</span>
            {` = "${theme}"`}
          </p>
          <p className="m-0">
            <span className="font-semibold text-foreground">colorScheme</span>
            {` = "${colorScheme}"`}
          </p>
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-border bg-card/80 p-6 shadow-lg shadow-primary/5">
          <Badge variant="outline" className="mb-3">
            Sans
          </Badge>
          <p className="m-0 font-heading text-2xl leading-tight">
            Oxanium gives OpenKitten World its playful, futuristic house voice.
          </p>
        </article>

        <article className="rounded-3xl border border-border bg-muted/60 p-6 shadow-lg shadow-primary/5">
          <Badge variant="outline" className="mb-3">
            Mono
          </Badge>
          <p className="m-0 font-mono text-sm leading-6 text-muted-foreground">
            session.claimedThreads[0] = "pricing-review"
            <br />
            cat.memory.append("Keep pricing practical and human-readable.")
          </p>
        </article>
      </div>
    </section>
  );
}
