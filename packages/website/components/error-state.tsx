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
        <div className="absolute left-0 top-12 size-72 rounded-full bg-destructive/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div
        role="alert"
        className="relative m-auto w-full max-w-[44rem] rounded-[2rem] border border-border/70 bg-card/95 p-8 shadow-xl shadow-destructive/5 backdrop-blur-sm"
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
