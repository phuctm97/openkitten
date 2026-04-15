import { Link } from "react-router";

export default function Component() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="m-0 font-heading text-5xl text-foreground">
          OpenKitten
        </h1>
        <nav aria-label="Home destinations" className="flex gap-4">
          <Link className="underline underline-offset-4" to="/app">
            Go to /app
          </Link>
          <Link className="underline underline-offset-4" to="/game">
            Go to /game
          </Link>
        </nav>
      </div>
    </main>
  );
}
