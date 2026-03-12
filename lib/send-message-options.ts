import type { SendOptions } from "~/lib/send-options";

export interface SendMessageOptions extends SendOptions {
  readonly text: string;
}
