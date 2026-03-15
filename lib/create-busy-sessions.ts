import type { BusySessions } from "~/lib/busy-sessions";
import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";
import type { Session } from "~/lib/session";

export function createBusySessions(): BusySessions {
  const sessionSet = new Set<string>();

  function invalidate({ statuses }: OpencodeSnapshot, ...sessions: Session[]) {
    for (const session of sessions) {
      const status = statuses[session.id];
      if (status?.type === "busy" || status?.type === "retry") {
        sessionSet.add(session.id);
      } else {
        sessionSet.delete(session.id);
      }
    }
  }

  function check(sessionId: string) {
    return sessionSet.has(sessionId);
  }

  function remove(...sessionIds: string[]) {
    for (const id of sessionIds) sessionSet.delete(id);
  }

  return {
    get sessionIds() {
      return [...sessionSet];
    },
    invalidate,
    check,
    remove,
  };
}
