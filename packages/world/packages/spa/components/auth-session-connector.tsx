import { useEffect } from "react";
import { startAuthSessionSync } from "~/lib/auth-session-sync";

export function AuthSessionConnector() {
  useEffect(() => {
    startAuthSessionSync();
  }, []);
  return null;
}
