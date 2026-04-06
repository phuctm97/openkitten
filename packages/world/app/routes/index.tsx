import { ThemeSwitcher } from "~/components/kibo-ui/theme-switcher";
import { Scene } from "~/components/scene";
import { Badge } from "~/components/ui/badge";
import { demoScenario } from "~/fixtures/demo-scenario";
import { expectValue } from "~/lib/expect-value";
import { useTheme } from "~/lib/use-theme";

export default function Component() {
  const { theme, setTheme } = useTheme();
  const activeCat = expectValue(
    demoScenario.cats[0],
    "Expected an active cat.",
  );
  const restingCat = expectValue(
    demoScenario.cats[1],
    "Expected a resting cat.",
  );
  const activeThread = expectValue(
    demoScenario.threads[0],
    "Expected an active thread.",
  );
  const highlightedNotice = expectValue(
    demoScenario.notices[0],
    "Expected a highlighted notice.",
  );
  const activeSession = expectValue(
    demoScenario.sessions[0],
    "Expected an active session.",
  );
  const activeTranscript = expectValue(
    activeSession.transcript,
    "Expected an active transcript.",
  );
  const transcriptPreview = activeTranscript.entries.slice(-2);
  const openThreadCount = demoScenario.threads.filter(
    ({ status }) => status === "Open",
  ).length;
  const unreadNoticeCount = demoScenario.notices.filter(
    ({ status }) => status === "Unread",
  ).length;

  return (
    <section className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      <header className="rounded-[2rem] border border-border/60 bg-card/72 p-6 shadow-[0_28px_80px_-52px_rgba(249,115,22,0.5)] backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Phase 2</Badge>
            <Badge variant="outline">Fixture-driven House</Badge>
          </div>

          <div className="flex items-start sm:items-end">
            <ThemeSwitcher value={theme} onChange={setTheme} />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <h1 className="m-0 font-heading text-[clamp(2.2rem,5vw,4.4rem)] leading-none">
            OpenKitten World
          </h1>
          <p className="m-0 max-w-[60ch] text-base leading-[1.65] text-muted-foreground">
            The home page now pulls from one fixed House scenario. Mochi is
            awake, Pepper is keeping watch, and the world shell has stable cats,
            threads, notices, and a running transcript ready for the next slice.
          </p>
        </div>
      </header>

      <Scene />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <article className="rounded-[2rem] border border-border/60 bg-card/78 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.9)] backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
                House Scenario
              </p>
              <h2 className="mt-2 font-heading text-[clamp(1.7rem,3vw,2.5rem)] leading-none">
                {demoScenario.house.name}
              </h2>
            </div>

            <Badge variant="outline">{demoScenario.human.name}</Badge>
          </div>

          <p className="mt-3 max-w-[64ch] text-sm leading-[1.7] text-muted-foreground">
            {demoScenario.house.summary}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Cats
              </p>
              <p className="mt-2 text-3xl font-heading leading-none">
                {demoScenario.cats.length}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Open Threads
              </p>
              <p className="mt-2 text-3xl font-heading leading-none">
                {openThreadCount}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Unread Notices
              </p>
              <p className="mt-2 text-3xl font-heading leading-none">
                {unreadNoticeCount}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Active Executor
              </p>
              <p className="mt-2 text-xl font-heading leading-none">
                {activeSession.executor.label}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
                Active Work
              </p>
              <h3 className="mt-2 text-lg font-semibold">
                {activeThread.title}
              </h3>
              <p className="mt-2 text-sm leading-[1.65] text-muted-foreground">
                {activeThread.summary}
              </p>
              <p className="mt-4 text-sm text-foreground/85">
                Assigned to {activeCat.name}, with one running session already
                claiming the thread.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
                House Props
              </p>
              <ul className="mt-3 space-y-2 pl-5 text-sm text-foreground/85">
                {demoScenario.house.props.map((prop) => (
                  <li key={prop.id}>{prop.label}</li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        <div className="grid gap-4">
          <article className="rounded-[2rem] border border-border/60 bg-card/78 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.9)] backdrop-blur-sm">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
              Cats
            </p>

            <div className="mt-4 grid gap-3">
              {[activeCat, restingCat].map((cat) => (
                <section
                  key={cat.id}
                  className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="m-0 text-lg font-semibold">{cat.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {cat.role}
                      </p>
                    </div>

                    <Badge
                      variant={
                        cat.status === "Working" ? "secondary" : "outline"
                      }
                    >
                      {cat.status}
                    </Badge>
                  </div>

                  <p className="mt-3 text-sm leading-[1.65] text-foreground/85">
                    {cat.flavor}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Assigned threads: {cat.assignedThreadIds.length}
                  </p>
                </section>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-border/60 bg-card/78 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.9)] backdrop-blur-sm">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
              Readable Surfaces
            </p>

            <section className="mt-4 rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Highlighted Notice
              </p>
              <h3 className="mt-2 text-lg font-semibold">
                {highlightedNotice.title}
              </h3>
              <p className="mt-2 text-sm leading-[1.65] text-muted-foreground">
                {highlightedNotice.summary}
              </p>
            </section>

            <section className="mt-3 rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Transcript Preview
              </p>

              <ul className="mt-3 space-y-3 pl-5 text-sm leading-[1.65] text-foreground/85">
                {transcriptPreview.map((entry) => (
                  <li key={entry.id}>
                    <span className="font-semibold capitalize">
                      {entry.kind}:
                    </span>{" "}
                    {entry.content}
                  </li>
                ))}
              </ul>
            </section>
          </article>
        </div>
      </div>
    </section>
  );
}
