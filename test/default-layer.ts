import { BunContext } from "@effect/platform-bun";
import { Layer } from "effect";
import { SandboxRuntimeConfig } from "~/lib/sandbox-runtime-config";
import { consoleLayer } from "~/test/console-layer";
import { databaseLayer } from "~/test/database-layer";
import { loggerLayer } from "~/test/logger-layer";
import { openCodeLayer } from "~/test/opencode-layer";

export const defaultLayer = openCodeLayer.pipe(
  Layer.provideMerge(SandboxRuntimeConfig.layer),
  Layer.provideMerge(databaseLayer),
  Layer.provideMerge(consoleLayer),
  Layer.provideMerge(loggerLayer),
  Layer.provideMerge(BunContext.layer),
);
