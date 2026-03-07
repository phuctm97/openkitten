import { Context } from "effect";
import { makeTag } from "~/lib/make-tag";

export class Scripts extends Context.Tag(makeTag("Scripts"))<
  Scripts,
  {
    readonly up: () => Promise<void>;
    readonly down: () => Promise<void>;
  }
>() {}
