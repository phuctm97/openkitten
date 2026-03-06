import { Console, Effect } from "effect";

const console = new Proxy({} as Console.Console, {
  get: (_, prop) => (prop === Console.TypeId ? Console.TypeId : Effect.void),
});

export const silentConsoleLayer = Console.setConsole(console);
