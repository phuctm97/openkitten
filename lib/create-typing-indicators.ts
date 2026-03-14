import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { consola } from "consola";
import type { Bot } from "grammy";
import { grammyCheckAccessError } from "~/lib/grammy-check-access-error";
import type { Session } from "~/lib/session";
import type { TypingIndicators } from "~/lib/typing-indicators";

export function createTypingIndicators(
  bot: Bot,
  opencodeClient: OpencodeClient,
): TypingIndicators {
  const timers = new Map<string, Timer | undefined>();

  async function invalidate(...sessions: Session[]) {
    if (sessions.length === 0) return;
    const [statusResult, questionResult, permissionResult] = await Promise.all([
      opencodeClient.session.status({}),
      opencodeClient.question.list({}),
      opencodeClient.permission.list({}),
    ]);
    if (statusResult.error) throw statusResult.error;
    if (questionResult.error) throw questionResult.error;
    if (permissionResult.error) throw permissionResult.error;
    const promises: Promise<void>[] = [];
    for (const session of sessions) {
      const status = statusResult.data[session.id];
      const isActive = status?.type === "busy" || status?.type === "retry";
      const hasQuestion = (questionResult.data ?? []).some(
        (q) => q.sessionID === session.id,
      );
      const hasPermission = (permissionResult.data ?? []).some(
        (p) => p.sessionID === session.id,
      );
      // Show typing only when the session is actively working (busy/retry)
      // and not waiting for user input (question or permission prompt).
      if (isActive && !hasQuestion && !hasPermission) {
        promises.push(start(session));
      } else {
        stop(session.id);
      }
    }
    await Promise.all(promises);
  }

  function stop(...sessionIds: string[]) {
    if (sessionIds.length === 0) return;
    for (const sessionId of sessionIds) {
      if (!timers.has(sessionId)) continue;
      const timer = timers.get(sessionId);
      if (timer) clearInterval(timer);
      timers.delete(sessionId);
    }
  }

  async function start(session: Session) {
    if (timers.has(session.id)) return;
    const chatId = session.chatId;
    const threadId = session.threadId || undefined;
    const send = () =>
      bot.api
        .sendChatAction(chatId, "typing", {
          ...(threadId && { message_thread_id: threadId }),
        })
        .catch((error) => {
          if (grammyCheckAccessError(error)) {
            stop(session.id);
          } else {
            consola.warn(
              "typing indicator failed",
              { sessionId: session.id, chatId, threadId },
              error,
            );
          }
        });
    timers.set(session.id, undefined);
    await send();
    if (!timers.has(session.id)) return;
    timers.set(session.id, setInterval(send, 4_000));
  }

  return {
    get sessionIds() {
      return [...timers.keys()];
    },
    invalidate,
    stop,
    [Symbol.dispose]() {
      stop(...timers.keys());
    },
  };
}
