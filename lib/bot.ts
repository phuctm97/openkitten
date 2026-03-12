import type { Bot as Client } from "grammy";

export interface Bot extends AsyncDisposable {
  readonly client: Client;
}
