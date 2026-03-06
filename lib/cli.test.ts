import { expect, test } from "bun:test";
import { BunContext } from "@effect/platform-bun";
import { Effect, Exit } from "effect";
import { cli } from "~/lib/cli";

const run = (...args: ReadonlyArray<string>) =>
	cli(["bun", ".", ...args]).pipe(
		Effect.provide(BunContext.layer),
		Effect.exit,
		Effect.runPromise,
	);

test("serve command succeeds", async () => {
	const exit = await run("serve");
	expect(Exit.isSuccess(exit)).toBe(true);
});

test("up command succeeds", async () => {
	const exit = await run("up");
	expect(Exit.isSuccess(exit)).toBe(true);
});

test("down command succeeds", async () => {
	const exit = await run("down");
	expect(Exit.isSuccess(exit)).toBe(true);
});

test("unknown command name fails", async () => {
	const exit = await run("unknown");
	expect(Exit.isFailure(exit)).toBe(true);
});
