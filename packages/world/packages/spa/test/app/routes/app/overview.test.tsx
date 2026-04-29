import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

type QueryName = "workspace" | "cat" | "goal" | "thread" | "notice" | "memo";

const mocks = vi.hoisted(() => ({
  workspace: undefined as unknown,
  cat: undefined as unknown,
  goal: undefined as unknown,
  thread: undefined as unknown,
  notice: undefined as unknown,
  memo: undefined as unknown,
  canMutate: true,
  date: new Date("2026-04-29T10:00:00Z"),
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
    sync: { queryOptions: () => ({ queryKey: [name, "sync"] }) },
  });
  return {
    orpcUtils: {
      workspace: make("workspace"),
      cat: make("cat"),
      goal: make("goal"),
      thread: make("thread"),
      notice: make("notice"),
      memo: make("memo"),
    },
  };
});

vi.mock("~/lib/use-can-mutate", () => ({
  useCanMutate: () => mocks.canMutate,
}));

vi.mock("~/lib/cat-avatar", () => ({
  CatAvatar: ({ cat }: { cat: { name: string } }) => (
    <span data-testid="cat-avatar">{cat.name}</span>
  ),
}));

afterEach(() => {
  mocks.workspace = undefined;
  mocks.cat = undefined;
  mocks.goal = undefined;
  mocks.thread = undefined;
  mocks.notice = undefined;
  mocks.memo = undefined;
  mocks.canMutate = true;
  vi.useRealTimers();
  vi.resetModules();
});

function renderOverview(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

test("renders empty rows for every section when all queries are empty", async () => {
  mocks.workspace = {
    activeMember: { id: "m1" },
    members: [{ id: "m1", user: { name: "Ada Lovelace" } }],
  };
  const { default: Component } = await import("~/app/routes/app/overview");
  renderOverview(<Component />);
  expect(screen.getByText("The house is quiet.")).toBeInTheDocument();
  expect(screen.getByText("An empty house.")).toBeInTheDocument();
  expect(screen.getByText("No threads yet.")).toBeInTheDocument();
  expect(screen.getByText("No goals yet.")).toBeInTheDocument();
  expect(screen.getByText("No memos yet.")).toBeInTheDocument();
});

test("renders unread notices, open threads, active goals, pinned memos, and cats", async () => {
  const now = new Date(Date.now() - 5 * 60 * 1000);
  mocks.workspace = {
    activeMember: { id: "m1" },
    members: [{ id: "m1", user: { name: "Ada Lovelace" } }],
  };
  mocks.cat = [
    { id: "c1", name: "Misty", isResting: false, avatar: null },
    { id: "c2", name: "Pepper", isResting: true, avatar: null },
  ];
  mocks.goal = [
    { id: "g1", title: "Onboard", status: "active" },
    { id: "g2", title: "Done", status: "achieved" },
  ];
  mocks.thread = [
    {
      id: "t1",
      title: "Refactor",
      summary: "Trim",
      status: "open",
      assignedCatId: "c1",
      updatedAt: now,
    },
  ];
  mocks.notice = [
    {
      id: "n1",
      kind: "general",
      subject: "Hello",
      body: "Body",
      readAt: null,
      createdAt: now,
    },
  ];
  mocks.memo = [
    {
      id: "m1",
      body: "Pinned line",
      pinnedAt: new Date(),
      targetCatId: "c1",
    },
  ];
  const { default: Component } = await import("~/app/routes/app/overview");
  renderOverview(<Component />);
  expect(screen.getByText("Hello")).toBeInTheDocument();
  expect(screen.getByText("Refactor")).toBeInTheDocument();
  expect(screen.getByText("Onboard")).toBeInTheDocument();
  expect(screen.getByText("Pinned line")).toBeInTheDocument();
  expect(screen.getAllByTestId("cat-avatar")).toHaveLength(2);
  expect(screen.getByText(/1 unread/)).toBeInTheDocument();
  expect(screen.getByText(/1 open/)).toBeInTheDocument();
  expect(screen.getByText(/1 active/)).toBeInTheDocument();
});

test("falls back to all notices when none are unread", async () => {
  const old = new Date(Date.now() - 60 * 60 * 1000);
  mocks.workspace = {
    activeMember: { id: "m1" },
    members: [{ id: "m1", user: { name: "Ada" } }],
  };
  mocks.notice = [
    {
      id: "n1",
      kind: "system",
      subject: "Read",
      body: null,
      readAt: new Date(),
      createdAt: old,
    },
  ];
  const { default: Component } = await import("~/app/routes/app/overview");
  renderOverview(<Component />);
  expect(screen.getByText("Read")).toBeInTheDocument();
  expect(screen.getByText(/all caught up/)).toBeInTheDocument();
});

test("shows member message when user cannot mutate", async () => {
  mocks.workspace = {
    activeMember: { id: "m1" },
    members: [{ id: "m1", user: { name: "Ada" } }],
  };
  mocks.canMutate = false;
  const { default: Component } = await import("~/app/routes/app/overview");
  renderOverview(<Component />);
  expect(
    screen.getByText(/Read along while the owners and admins steer this house/),
  ).toBeInTheDocument();
});

test("renders fallback labels for older time ranges in inbox section", async () => {
  const justNow = new Date(Date.now() - 10 * 1000);
  const yesterday = new Date(Date.now() - 23 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  mocks.workspace = {
    activeMember: { id: "m1" },
    members: [{ id: "m1", user: { name: "Ada" } }],
  };
  mocks.notice = [
    {
      id: "n1",
      kind: "general",
      subject: "JustNow",
      body: null,
      readAt: null,
      createdAt: justNow,
    },
    {
      id: "n2",
      kind: "general",
      subject: "Yesterday",
      body: null,
      readAt: null,
      createdAt: yesterday,
    },
    {
      id: "n3",
      kind: "general",
      subject: "ThreeDays",
      body: null,
      readAt: null,
      createdAt: threeDaysAgo,
    },
    {
      id: "n4",
      kind: "general",
      subject: "Older",
      body: null,
      readAt: null,
      createdAt: tenDaysAgo,
    },
  ];
  const { default: Component } = await import("~/app/routes/app/overview");
  renderOverview(<Component />);
  expect(screen.getByText("JustNow")).toBeInTheDocument();
  expect(screen.getByText("Yesterday")).toBeInTheDocument();
  expect(screen.getByText("ThreeDays")).toBeInTheDocument();
  expect(screen.getByText("Older")).toBeInTheDocument();
});

test("falls back to closed threads and 'all closed' meta when none open", async () => {
  mocks.workspace = {
    activeMember: { id: "m1" },
    members: [{ id: "m1", user: { name: "Ada" } }],
  };
  mocks.thread = [
    {
      id: "t1",
      title: "Old work",
      summary: null,
      status: "closed",
      assignedCatId: null,
      updatedAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/overview");
  renderOverview(<Component />);
  expect(screen.getByText("Old work")).toBeInTheDocument();
  expect(screen.getByText(/all closed/)).toBeInTheDocument();
});

test("falls back to all goals when none active", async () => {
  mocks.workspace = {
    activeMember: { id: "m1" },
    members: [{ id: "m1", user: { name: "Ada" } }],
  };
  mocks.goal = [{ id: "g1", title: "Done", status: "achieved" }];
  const { default: Component } = await import("~/app/routes/app/overview");
  renderOverview(<Component />);
  expect(screen.getByText("Done")).toBeInTheDocument();
});

test("renders memo count meta when there are memos but none pinned", async () => {
  mocks.workspace = {
    activeMember: { id: "m1" },
    members: [{ id: "m1", user: { name: "Ada" } }],
  };
  mocks.memo = [
    { id: "m1", body: "First", pinnedAt: null, targetCatId: null },
    { id: "m2", body: "Second", pinnedAt: null, targetCatId: null },
  ];
  const { default: Component } = await import("~/app/routes/app/overview");
  renderOverview(<Component />);
  expect(screen.getByText(/2 memos/)).toBeInTheDocument();
});

test("uses singular memo when only one memo and none pinned", async () => {
  mocks.workspace = {
    activeMember: { id: "m1" },
    members: [{ id: "m1", user: { name: "Ada" } }],
  };
  mocks.memo = [{ id: "m1", body: "Only", pinnedAt: null, targetCatId: null }];
  const { default: Component } = await import("~/app/routes/app/overview");
  renderOverview(<Component />);
  expect(screen.getByText(/1 memo/)).toBeInTheDocument();
});

test.each([
  { hour: 3, label: "Late night" },
  { hour: 9, label: "Good morning" },
  { hour: 14, label: "Good afternoon" },
  { hour: 19, label: "Good evening" },
  { hour: 22, label: "Goodnight" },
])("uses '$label' as the day part greeting at hour $hour", async ({
  hour,
  label,
}) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 3, 29, hour, 0, 0));
  mocks.workspace = {
    activeMember: { id: "m1" },
    members: [{ id: "m1", user: { name: "Ada Lovelace" } }],
  };
  const { default: Component } = await import("~/app/routes/app/overview");
  renderOverview(<Component />);
  expect(
    screen.getByRole("heading", { name: new RegExp(label) }),
  ).toBeInTheDocument();
});
