import type {
  Hooks,
  PluginInput,
  PluginModule,
  PluginOptions,
} from "@opencode-ai/plugin";
import {
  type OpenkittenContext,
  OpenkittenContext as OpenkittenContextImpl,
} from "./openkitten-context";

export function definePlugin(
  id: string,
  factory: definePlugin.Factory,
): PluginModule {
  return {
    id,
    server: async (opencode: PluginInput, options?: PluginOptions) => {
      const openkitten = await OpenkittenContextImpl.create();
      return factory({ opencode, openkitten }, options);
    },
  };
}

export namespace definePlugin {
  export interface Input {
    readonly opencode: PluginInput;
    readonly openkitten: OpenkittenContext;
  }

  export type Factory = (
    input: Input,
    options?: PluginOptions,
  ) => Promise<Hooks>;
}
