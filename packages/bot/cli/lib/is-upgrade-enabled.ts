export function isUpgradeEnabled(): boolean {
  return Boolean(Bun.env["OPENKITTEN_ENABLE_UPGRADE"]);
}
