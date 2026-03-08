import { Context, type Effect } from "effect";
import pkg from "~/package.json" with { type: "json" };

export class Shell extends Context.Tag(`${pkg.name}/Shell`)<
  Shell,
  (strings: TemplateStringsArray, ...values: Shell.Value[]) => Shell.Command
>() {}

export namespace Shell {
  export type Value = string | number | boolean;

  export type Command = Effect.Effect<string> & {
    readonly cwd: (dir: string) => Command;
  };
}
