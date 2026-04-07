import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import type { Bot } from "grammy";
import invariant from "tiny-invariant";
import type { Database } from "~/lib/database";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { getSessionAgent } from "~/lib/get-session-agent";
import { grammySendSessionPending } from "~/lib/grammy-send-session-pending";
import type { MediaGroupBuffer } from "~/lib/media-group-buffer";
import { PendingPrompts } from "~/lib/pending-prompts";
import { WorkingSessions } from "~/lib/working-sessions";

interface MediaGroupFlushScope {
  readonly bot: Bot;
  readonly database: Database;
  readonly opencodeClient: OpencodeClient;
  readonly existingSessions: ExistingSessions;
  readonly workingSessions: WorkingSessions;
  readonly pendingPrompts: PendingPrompts;
}

export async function grammyHandleMediaGroupFlush(
  {
    bot,
    database,
    opencodeClient,
    existingSessions,
    workingSessions,
    pendingPrompts,
  }: MediaGroupFlushScope,
  entries: readonly MediaGroupBuffer.Entry[],
): Promise<void> {
  const first = entries[0];
  invariant(first, "Expected at least one entry in media group");

  const sessionId = await existingSessions.find(
    { chatId: first.chatId, threadId: first.threadId },
    { createIfNotFound: true },
  );

  try {
    await pendingPrompts.protect({
      sessionId,
      messageId: first.messageId,
    });
    return;
  } catch (error) {
    if (!(error instanceof PendingPrompts.NotFoundError)) throw error;
  }

  try {
    await workingSessions.lock(sessionId, async () => {
      const agent = getSessionAgent(database, sessionId);
      const downloaded = await Promise.all(entries.map((e) => e.download()));
      const parts = downloaded.flat();
      await opencodeClient.session.promptAsync(
        {
          sessionID: sessionId,
          ...(agent && { agent }),
          parts,
        },
        { throwOnError: true },
      );
    });
  } catch (error) {
    if (!(error instanceof WorkingSessions.LockedError)) throw error;
    await grammySendSessionPending({
      bot,
      chatId: first.chatId,
      threadId: first.threadId,
      replyToMessageId: first.messageId,
    });
  }
}
