import { renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  data: undefined as unknown,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: mocks.data }),
  };
});

vi.mock("~/lib/orpc-utils", () => ({
  orpcUtils: {
    workspace: {
      sync: { queryOptions: () => ({ queryKey: ["workspace", "sync"] }) },
    },
  },
}));

afterEach(() => {
  mocks.data = undefined;
});

test("returns false when workspace data is not loaded", async () => {
  mocks.data = undefined;
  const { useCanMutate } = await import("~/lib/use-can-mutate");
  const { result } = renderHook(() => useCanMutate());
  expect(result.current).toBe(false);
});

test("returns true for owner role", async () => {
  mocks.data = { activeMember: { role: "owner" } };
  const { useCanMutate } = await import("~/lib/use-can-mutate");
  const { result } = renderHook(() => useCanMutate());
  expect(result.current).toBe(true);
});

test("returns true for admin role", async () => {
  mocks.data = { activeMember: { role: "admin" } };
  const { useCanMutate } = await import("~/lib/use-can-mutate");
  const { result } = renderHook(() => useCanMutate());
  expect(result.current).toBe(true);
});

test("returns false for member role", async () => {
  mocks.data = { activeMember: { role: "member" } };
  const { useCanMutate } = await import("~/lib/use-can-mutate");
  const { result } = renderHook(() => useCanMutate());
  expect(result.current).toBe(false);
});
