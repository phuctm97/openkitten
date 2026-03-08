import { expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { vi } from "vitest";
import { cli } from "~/lib/cli";
import { Scripts } from "~/lib/scripts";
import { botLayer } from "~/test/bot-layer";
import { defaultLayer } from "~/test/default-layer";
import { opencodeLayer } from "~/test/opencode-layer";

vi.mock("@opencode-ai/sdk/v2/client", () => ({
  createOpencodeClient: () => ({}),
}));

const serverLayer = botLayer.pipe(Layer.provideMerge(opencodeLayer));

const scriptsMock = Scripts.of({
  up: vi.fn().mockResolvedValue(undefined),
  down: vi.fn().mockResolvedValue(undefined),
});

const scriptsLayer = Layer.succeed(Scripts, scriptsMock);

const run = (command: string) =>
  cli({ argv: ["bun", ".", command], serverLayer, scriptsLayer }).pipe(
    Effect.provide(defaultLayer),
  );

it.scopedLive.fails("unknown command fails", () => run("unknown"));

it.scopedLive("up command succeeds", () =>
  run("up").pipe(
    Effect.map(() => expect(scriptsMock.up).toHaveBeenCalledOnce()),
  ),
);

it.scopedLive("down command succeeds", () =>
  run("down").pipe(
    Effect.map(() => expect(scriptsMock.down).toHaveBeenCalledOnce()),
  ),
);

it.scopedLive("serve command starts and can be interrupted", () =>
  run("serve").pipe(
    Effect.timeout(0),
    Effect.option,
    Effect.map((opt) => expect(opt).toEqual(Option.none())),
  ),
);
