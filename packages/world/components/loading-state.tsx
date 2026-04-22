export function LoadingState() {
  return (
    <section className="grid min-h-screen place-items-center bg-background px-6 py-10">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-sm flex-col items-center gap-4 text-center"
      >
        <div className="flex size-14 items-center justify-center rounded-full border border-border bg-muted/50">
          <span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
        <p className="m-0 text-sm leading-6 text-muted-foreground">
          Loading OpenKitten
        </p>
      </div>
    </section>
  );
}
