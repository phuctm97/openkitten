import { useEffect } from "react";
import { startAuthSessionSync } from "~/lib/start-auth-session-sync";

export function AuthSessionConnector() {
  useEffect(() => {
    startAuthSessionSync();
  }, []);
  return null;
}
