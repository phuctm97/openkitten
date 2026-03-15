import type { BusySessions } from "~/lib/busy-sessions";
import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";
import type { Session } from "~/lib/session";

export function createBusySessions(): BusySessions {
  const sessions = new Set<string>();

  function invalidate(
    { statuses }: OpencodeSnapshot,
    ...sessionsArr: Session[]
  ) {
    for (const session of sessionsArr) {
      const status = statuses[session.id];
      if (status?.type === "busy" || status?.type === "retry") {
        sessions.add(session.id);
      } else {
        sessions.delete(session.id);
      }
    }
  }

  function check(sessionId: string) {
    return sessions.has(sessionId);
  }

  function remove(...sessionIds: string[]) {
    for (const id of sessionIds) sessions.delete(id);
  }

  return {
    get sessionIds() {
      return [...sessions];
    },
    invalidate,
    check,
    remove,
  };
}
