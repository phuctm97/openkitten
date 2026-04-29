import { afterEach, expect, it, vi } from "vitest";
import { generateCatSlug } from "~/lib/generate-cat-slug";

afterEach(() => {
  vi.restoreAllMocks();
});

function stubRandomUUID(value: string) {
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    value as `${string}-${string}-${string}-${string}-${string}`,
  );
}

it("kebab-cases the seed and appends a 6-character suffix", () => {
  stubRandomUUID("12345678-90ab-cdef-1234-567890abcdef");
  const slug = generateCatSlug("Misty Cat");
  expect(slug).toBe("misty-cat-123456");
});

it("collapses non-alphanumeric runs into a single dash", () => {
  stubRandomUUID("aabbccdd-1234-5678-9abc-def012345678");
  const slug = generateCatSlug("Hello!! World??");
  expect(slug.startsWith("hello-world-")).toBe(true);
});

it("falls back to 'cat' when the seed is empty after sanitization", () => {
  stubRandomUUID("00000000-0000-0000-0000-000000000000");
  const slug = generateCatSlug("???");
  expect(slug.startsWith("cat-")).toBe(true);
});

it("falls back to 'cat' when the seed is the empty string", () => {
  stubRandomUUID("00000000-0000-0000-0000-000000000000");
  const slug = generateCatSlug("");
  expect(slug.startsWith("cat-")).toBe(true);
});

it("truncates the sanitized base to 32 characters before appending the suffix", () => {
  stubRandomUUID("ffffffff-ffff-ffff-ffff-ffffffffffff");
  const slug = generateCatSlug("a".repeat(80));
  const base = slug.split("-")[0];
  expect(base?.length).toBeLessThanOrEqual(32);
});
