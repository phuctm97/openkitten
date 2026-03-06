import { Console, Effect } from "effect";

export const silentConsole = new Proxy({} as Console.Console, {
	get: (_, prop) => (prop === Console.TypeId ? Console.TypeId : Effect.void),
});
