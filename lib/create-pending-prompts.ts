import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { consola } from "consola";
import type { PendingPrompts } from "~/lib/pending-prompts";
import type { Session } from "~/lib/session";

interface PendingEntry {
  readonly questionIds: readonly string[];
  readonly permissionIds: readonly string[];
}

export function createPendingPrompts(
  opencodeClient: OpencodeClient,
): PendingPrompts {
  const entries = new Map<string, PendingEntry>();

  function dismiss(...sessionIds: string[]) {
    for (const sessionId of sessionIds) {
      const entry = entries.get(sessionId);
      if (!entry) continue;
      for (const requestID of entry.questionIds) {
        opencodeClient.question
          .reject({ requestID })
          .catch((error: unknown) => {
            consola.warn(
              "pending prompt dismiss question failed",
              { sessionId, requestID },
              error,
            );
          });
      }
      for (const requestID of entry.permissionIds) {
        opencodeClient.permission
          .reply({ requestID, reply: "reject" })
          .catch((error: unknown) => {
            consola.warn(
              "pending prompt dismiss permission failed",
              { sessionId, requestID },
              error,
            );
          });
      }
      entries.delete(sessionId);
      consola.debug("pending prompts dismissed", { sessionId });
    }
  }

  async function invalidate(...sessions: Session[]) {
    const [questionResult, permissionResult] = await Promise.all([
      opencodeClient.question.list({}),
      opencodeClient.permission.list({}),
    ]);
    if (questionResult.error) throw questionResult.error;
    if (permissionResult.error) throw permissionResult.error;
    const questions = questionResult.data ?? [];
    const permissions = permissionResult.data ?? [];
    for (const session of sessions) {
      const questionIds = questions
        .filter((q) => q.sessionID === session.id)
        .map((q) => q.id);
      const permissionIds = permissions
        .filter((p) => p.sessionID === session.id)
        .map((p) => p.id);
      if (questionIds.length > 0 || permissionIds.length > 0) {
        entries.set(session.id, { questionIds, permissionIds });
      } else {
        entries.delete(session.id);
      }
    }
  }

  return {
    get sessionIds() {
      return [...entries.keys()];
    },
    invalidate,
    dismiss,
    [Symbol.dispose]() {
      dismiss(...entries.keys());
    },
  };
}
