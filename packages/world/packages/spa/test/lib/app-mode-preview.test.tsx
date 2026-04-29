import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

type QueryName = "cat" | "goal" | "thread" | "notice";

const mocks = vi.hoisted(() => ({
  cat: undefined as unknown,
  goal: undefined as unknown,
  thread: undefined as unknown,
  notice: undefined as unknown,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey: [QueryName, string] }) => {
      const [name] = options.queryKey;
      return { data: mocks[name] };
    },
  };
});

vi.mock("~/lib/orpc-utils", () => {
  const make = (name: QueryName) => ({
    list: { queryOptions: () => ({ queryKey: [name, "list"] }) },
  });
  return {
    orpcUtils: {
      cat: make("cat"),
      goal: make("goal"),
      thread: make("thread"),
      notice: make("notice"),
    },
  };
});

afterEach(() => {
  mocks.cat = undefined;
  mocks.goal = undefined;
  mocks.thread = undefined;
  mocks.notice = undefined;
});

test("renders zero-state tiles when queries are empty", async () => {
  const { AppModePreview } = await import("~/lib/app-mode-preview");
  render(<AppModePreview />);
  expect(screen.getAllByText("0")).toHaveLength(4);
  expect(screen.getByText("Cats")).toBeInTheDocument();
  expect(screen.getByText("Goals")).toBeInTheDocument();
  expect(screen.getByText("Threads")).toBeInTheDocument();
  expect(screen.getByText("Inbox")).toBeInTheDocument();
});

test("counts cats, active goals, open threads, and unread notices", async () => {
  mocks.cat = [{}, {}];
  mocks.goal = [{ status: "active" }, { status: "completed" }];
  mocks.thread = [{ status: "open" }, { status: "open" }, { status: "closed" }];
  mocks.notice = [{ readAt: null }, { readAt: new Date() }, { readAt: null }];
  const { AppModePreview } = await import("~/lib/app-mode-preview");
  render(<AppModePreview />);
  expect(screen.getAllByText("2")).toHaveLength(3);
  expect(screen.getByText("1")).toBeInTheDocument();
});
