import type { Bot as Client } from "grammy";

export interface Grammy extends AsyncDisposable {
  readonly stopped: Promise<void>;
  readonly client: Client;
}
