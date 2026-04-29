function sanitize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function generateHouseSlug(seed: string): string {
  const base = sanitize(seed) || "house";
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${base}-${suffix}`;
}
