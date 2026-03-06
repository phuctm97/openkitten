import { expect, test } from "bun:test";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import { cli } from "~/lib/cli";

const run = (...args: ReadonlyArray<string>) =>
	cli(["bun", ".", ...args]).pipe(
		Effect.provide(BunContext.layer),
		Effect.runPromise,
	);

for (const cmd of ["serve", "up", "down"])
	test(`${cmd} command succeeds`, () =>
		expect(run(cmd)).resolves.toBeUndefined());

test("unknown command fails", () => expect(run("unknown")).rejects.toThrow());
