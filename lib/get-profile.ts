export function getProfile(): string {
  return Bun.env["OPENKITTEN_PROFILE"] || "default";
}
