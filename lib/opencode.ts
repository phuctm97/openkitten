import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";

export interface Opencode extends AsyncDisposable {
  readonly exited: Promise<void>;
  readonly client: OpencodeClient;
}
