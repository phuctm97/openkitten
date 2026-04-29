import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cats: {
    data: undefined as { id: string }[] | undefined,
    isPending: false,
  },
  goals: {
    data: undefined as { status: string }[] | undefined,
    isPending: false,
  },
  threads: {
    data: undefined as { status: string }[] | undefined,
    isPending: false,
  },
  notices: {
    data: undefined as { readAt: Date | null }[] | undefined,
    isPending: false,
  },
}));

const queryKeys = {
  catList: { queryKey: ["cat", "list"] },
  goalList: { queryKey: ["goal", "list"] },
  threadList: { queryKey: ["thread", "list"] },
  noticeList: { queryKey: ["notice", "list"] },
};

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
      const [entity] = queryKey;
      if (entity === "cat") return mocks.cats;
      if (entity === "goal") return mocks.goals;
      if (entity === "thread") return mocks.threads;
      if (entity === "notice") return mocks.notices;
      throw new Error(`Unexpected query key: ${String(entity)}`);
    },
  };
});

vi.mock("~/lib/orpc-utils", () => ({
  orpcUtils: {
    cat: { list: { queryOptions: () => queryKeys.catList } },
    goal: { list: { queryOptions: () => queryKeys.goalList } },
    thread: { list: { queryOptions: () => queryKeys.threadList } },
    notice: { list: { queryOptions: () => queryKeys.noticeList } },
  },
}));

afterEach(() => {
  mocks.cats.data = undefined;
  mocks.cats.isPending = false;
  mocks.goals.data = undefined;
  mocks.goals.isPending = false;
  mocks.threads.data = undefined;
  mocks.threads.isPending = false;
  mocks.notices.data = undefined;
  mocks.notices.isPending = false;
});

test("renders dashes for each tile while data is pending", async () => {
  mocks.cats.isPending = true;
  mocks.goals.isPending = true;
  mocks.threads.isPending = true;
  mocks.notices.isPending = true;
  const { DashboardOverviewCard } = await import(
    "~/lib/dashboard-overview-card"
  );
  render(<DashboardOverviewCard />);
  expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
});

test("renders counts and secondary hints once data is loaded", async () => {
  mocks.cats.data = [{ id: "1" }, { id: "2" }];
  mocks.goals.data = [{ status: "active" }, { status: "achieved" }];
  mocks.threads.data = [{ status: "open" }, { status: "closed" }];
  mocks.notices.data = [{ readAt: null }, { readAt: new Date() }];
  const { DashboardOverviewCard } = await import(
    "~/lib/dashboard-overview-card"
  );
  render(<DashboardOverviewCard />);
  expect(screen.getByText("1 active")).toBeInTheDocument();
  expect(screen.getByText("1 open")).toBeInTheDocument();
  expect(screen.getByText("1 unread")).toBeInTheDocument();
});
