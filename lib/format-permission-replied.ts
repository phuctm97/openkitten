export function formatPermissionReplied(reply: "once" | "always" | "reject") {
  if (reply === "once") return "✓ Allowed once";
  if (reply === "always") return "✓ Always allowed";
  return "✕ Denied";
}
