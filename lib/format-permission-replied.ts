export function formatPermissionReplied(reply: "once" | "always" | "reject") {
  if (reply === "once") return "✓ Allowed (Once)";
  if (reply === "always") return "✓ Allowed (Always)";
  return "✕ Denied";
}
