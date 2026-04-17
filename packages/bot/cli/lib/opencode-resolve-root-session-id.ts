import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";

export async function opencodeResolveRootSessionId(
  opencodeClient: OpencodeClient,
  sessionId: string,
): Promise<string> {
  const { data: session } = await opencodeClient.session.get(
    { sessionID: sessionId },
    { throwOnError: true },
  );
  if (!session.parentID) return sessionId;
  return opencodeResolveRootSessionId(opencodeClient, session.parentID);
}
