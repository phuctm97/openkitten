export default function Component() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-8 text-card-foreground shadow-xl shadow-primary/5">
        <p className="mb-2 mt-0 text-sm font-bold uppercase tracking-[0.06em] text-primary/80">
          House
        </p>
        <h2 className="mb-4 mt-0 font-heading text-[clamp(1.6rem,2.8vw,2.4rem)] leading-[1.1]">
          House Route Placeholder
        </h2>
        <p className="m-0 max-w-[64ch] text-base leading-[1.6]">
          This route will eventually become the first playable House slice with
          cats, notices, threads, and an active session view.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-border bg-card/80 p-6 shadow-lg shadow-primary/5">
          <p className="mb-2 mt-0 text-sm font-bold uppercase tracking-[0.06em] text-primary/80">
            Sans
          </p>
          <p className="m-0 font-heading text-2xl leading-tight">
            Oxanium gives OpenKitten World its playful, futuristic house voice.
          </p>
        </article>

        <article className="rounded-3xl border border-border bg-muted/60 p-6 shadow-lg shadow-primary/5">
          <p className="mb-2 mt-0 text-sm font-bold uppercase tracking-[0.06em] text-primary/80">
            Mono
          </p>
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
