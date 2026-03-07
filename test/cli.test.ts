import { expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { vi } from "vitest";

vi.mock("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: () => ({}),
}));

import { cli } from "~/lib/cli";
import { Scripts } from "~/lib/scripts";
import { botLayer } from "~/test/bot-layer";
import { defaultLayer } from "~/test/default-layer";

const scriptsMock = Scripts.of({
  up: vi.fn().mockResolvedValue(undefined),
  down: vi.fn().mockResolvedValue(undefined),
});

const scriptsLayer = Layer.succeed(Scripts, scriptsMock);

const testLayer = botLayer.pipe(
  Layer.provideMerge(scriptsLayer),
  Layer.provideMerge(defaultLayer),
);

it.scopedLive.fails("unknown command fails", () =>
  cli(["bun", ".", "unknown"]).pipe(Effect.provide(testLayer)),
);

it.scopedLive("up command succeeds", () =>
  cli(["bun", ".", "up"]).pipe(
    Effect.provide(testLayer),
    Effect.map(() => expect(scriptsMock.up).toHaveBeenCalledOnce()),
  ),
);

it.scopedLive("down command succeeds", () =>
  cli(["bun", ".", "down"]).pipe(
    Effect.provide(testLayer),
    Effect.map(() => expect(scriptsMock.down).toHaveBeenCalledOnce()),
  ),
);

it.scopedLive("serve command starts and can be interrupted", () =>
  cli(["bun", ".", "serve"]).pipe(
    Effect.provide(testLayer),
    Effect.timeout(0),
    Effect.option,
    Effect.map((opt) => expect(opt).toEqual(Option.none())),
  ),
);
