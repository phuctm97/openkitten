import { Context } from "effect";
import pkg from "~/package.json" with { type: "json" };

export class Scripts extends Context.Tag(`${pkg.name}/Scripts`)<
  Scripts,
  {
    readonly up: () => Promise<void>;
    readonly down: () => Promise<void>;
  }
>() {}
