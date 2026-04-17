import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export type ErrorStateProps = Readonly<{
  badge: string;
  message: string;
  details: string;
}>;

export function ErrorState({ badge, message, details }: ErrorStateProps) {
  return (
    <section className="relative grid flex-1 overflow-hidden bg-background px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-40 [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
        <div className="absolute left-[-8rem] top-[-6rem] size-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] size-96 rounded-full bg-accent/60 blur-3xl" />
      </div>
      <div
        role="alert"
        className="relative m-auto w-full max-w-[44rem] rounded-[2rem] bg-card p-8 shadow-sm shadow-primary/5 ring-1 ring-border/50"
      >
        <Badge variant="outline">{badge}</Badge>
        <h2 className="mb-3 mt-5 font-heading text-[clamp(1.8rem,3vw,2.7rem)] leading-[1.1]">
          {message}
        </h2>
        <p className="m-0 max-w-[60ch] text-base leading-[1.7] text-muted-foreground">
          {details}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <form className="contents">
            <Button type="submit">Reload Page</Button>
          </form>
          <Button variant="outline" asChild>
            <a href="/">Go Home</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
