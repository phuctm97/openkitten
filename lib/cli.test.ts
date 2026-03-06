import { expect, test } from "bun:test";
import { BunContext } from "@effect/platform-bun";
import { Console, Effect, Layer } from "effect";
import { cli } from "~/lib/cli";

const silentConsole = new Proxy({} as Console.Console, {
	get: (_, prop) => (prop === Console.TypeId ? Console.TypeId : Effect.void),
});

const run = (...args: ReadonlyArray<string>) =>
	cli(["bun", ".", ...args]).pipe(
		Effect.provide(
			Layer.merge(BunContext.layer, Console.setConsole(silentConsole)),
		),
		Effect.runPromise,
	);

for (const cmd of ["serve", "up", "down"])
	test(`${cmd} command succeeds`, () =>
		expect(run(cmd)).resolves.toBeUndefined());

test("unknown command fails", () => expect(run("unknown")).rejects.toThrow());
