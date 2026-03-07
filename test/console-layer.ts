import { Console, Effect } from "effect";

export const consoleLayer = Console.setConsole(
  new Proxy({} as Console.Console, {
    get: (_target, prop) =>
      prop === Console.TypeId ? Console.TypeId : () => Effect.void,
  }),
);
