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

export function definePlugin<TOptions extends PluginOptions = PluginOptions>(
  id: string,
  factory: definePlugin.Factory<TOptions>,
): PluginModule {
  return {
    id,
    server: async (opencode: PluginInput, options?: PluginOptions) => {
      const openkitten = await OpenkittenContextImpl.create();
      return factory({
        opencode,
        openkitten,
        options: options as TOptions,
      });
    },
  };
}

export namespace definePlugin {
  export interface Input<TOptions extends PluginOptions = PluginOptions> {
    readonly opencode: PluginInput;
    readonly openkitten: OpenkittenContext;
    readonly options: TOptions | undefined;
  }

  export type Factory<TOptions extends PluginOptions = PluginOptions> = (
    input: Input<TOptions>,
  ) => Promise<Hooks>;
}
