import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { consola } from "consola";
import type { Bot } from "grammy";
import type { Session } from "~/lib/session";
import type { TypingIndicators } from "~/lib/typing-indicators";

export function createTypingIndicators(
  bot: Bot,
  opencodeClient: OpencodeClient,
): TypingIndicators {
  const timers = new Map<string, Timer>();

  function start(session: Session) {
    if (timers.has(session.id)) return;
    const chatId = session.chatId;
    const threadId = session.threadId || undefined;
    const send = () =>
      bot.api
        .sendChatAction(chatId, "typing", {
          ...(threadId && { message_thread_id: threadId }),
        })
        .catch((error) => {
          consola.warn("typing indicator send error", error);
        });
    send();
    timers.set(session.id, setInterval(send, 4_000));
    consola.debug("typing indicator started", { chatId, threadId });
  }

  function stop(sessionId: string) {
    const timer = timers.get(sessionId);
    if (!timer) return;
    clearInterval(timer);
    timers.delete(sessionId);
    consola.debug("typing indicator stopped", { sessionId });
  }

  function invalidate(session: Session) {
    check(session).catch((error) => {
      consola.error("typing indicator check error", error);
    });
  }

  async function check(session: Session) {
    const [statusResult, questionResult, permissionResult] = await Promise.all([
      opencodeClient.session.status({}),
      opencodeClient.question.list({}),
      opencodeClient.permission.list({}),
    ]);
    if (statusResult.error) throw statusResult.error;
    if (questionResult.error) throw questionResult.error;
    if (permissionResult.error) throw permissionResult.error;
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
      start(session);
    } else {
      stop(session.id);
    }
  }

  return {
    invalidate,
    [Symbol.dispose]() {
      for (const sessionId of timers.keys()) stop(sessionId);
    },
  };
}
