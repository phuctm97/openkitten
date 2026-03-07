import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
import { Effect, Layer } from "effect";
import { OpenCode } from "~/lib/opencode";

export const opencodeLayer = Layer.effect(
  OpenCode,
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(Effect.never);
    return { fiber, client: createOpencodeClient() };
  }),
);
