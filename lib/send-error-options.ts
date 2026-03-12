import type { SendOptions } from "~/lib/send-options";

export interface SendErrorOptions extends SendOptions {
  readonly error: unknown;
}
