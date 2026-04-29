import { afterEach, expect, it, vi } from "vitest";
import { generateHouseSlug } from "~/lib/generate-house-slug";

afterEach(() => {
  vi.restoreAllMocks();
});

function stubRandomUUID(value: string) {
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    value as `${string}-${string}-${string}-${string}-${string}`,
  );
}

it("kebab-cases the seed and appends a random suffix", () => {
  stubRandomUUID("12345678-90ab-cdef-1234-567890abcdef");
  const slug = generateHouseSlug("Ada Lovelace");
  expect(slug).toBe("ada-lovelace-12345678");
});

it("strips diacritics and special characters into a single dash", () => {
  stubRandomUUID("aabbccdd-1234-5678-9abc-def012345678");
  const slug = generateHouseSlug("Hello!! World??  Foo");
  expect(slug.startsWith("hello-world-foo-")).toBe(true);
});

it("falls back to 'house' when the seed is empty after sanitization", () => {
  stubRandomUUID("00000000-0000-0000-0000-000000000000");
  const slug = generateHouseSlug("!!!");
  expect(slug.startsWith("house-")).toBe(true);
});

it("falls back to 'house' when the seed is the empty string", () => {
  stubRandomUUID("00000000-0000-0000-0000-000000000000");
  const slug = generateHouseSlug("");
  expect(slug.startsWith("house-")).toBe(true);
});

it("truncates the sanitized base to 32 characters before appending the suffix", () => {
  stubRandomUUID("ffffffff-ffff-ffff-ffff-ffffffffffff");
  const long = "a".repeat(80);
  const slug = generateHouseSlug(long);
  const [base] = slug.split("-");
  expect(base?.length).toBeLessThanOrEqual(32);
});
