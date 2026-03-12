import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";

export interface OpenCodeProcess extends AsyncDisposable {
  readonly client: OpencodeClient;
  readonly exited: Promise<void>;
}
