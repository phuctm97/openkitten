import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notices: undefined as unknown,
  canMutate: true,
  markReadMutate: vi.fn(),
  markAllReadMutate: vi.fn(),
  invalidateQueries: vi.fn(async () => {}),
}));

type MutationOptions = {
  mutationKey?: unknown[];
  onSuccess?: () => Promise<void> | void;
};

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: mocks.notices }),
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
    useMutation: (options: MutationOptions) => {
      const key = JSON.stringify(options.mutationKey ?? []);
      const target = key.includes("markAllRead")
        ? mocks.markAllReadMutate
        : mocks.markReadMutate;
      const mutate = (input: unknown) => {
        target(input);
        void options.onSuccess?.();
      };
      return { mutate, isPending: false };
    },
  };
});

vi.mock("~/lib/orpc-utils", () => ({
  orpcUtils: {
    notice: {
      list: {
        queryOptions: () => ({ queryKey: ["notice", "list"] }),
        queryKey: () => ["notice", "list"],
      },
      markRead: {
        mutationOptions: (opts: MutationOptions) => ({
          mutationKey: ["notice", "markRead"],
          ...opts,
        }),
      },
      markAllRead: {
        mutationOptions: (opts: MutationOptions) => ({
          mutationKey: ["notice", "markAllRead"],
          ...opts,
        }),
      },
    },
  },
}));

vi.mock("~/lib/use-can-mutate", () => ({
  useCanMutate: () => mocks.canMutate,
}));

vi.mock("~/lib/toast-error", () => ({ toastError: vi.fn() }));

afterEach(() => {
  mocks.notices = undefined;
  mocks.canMutate = true;
  mocks.markReadMutate.mockReset();
  mocks.markAllReadMutate.mockReset();
  mocks.invalidateQueries.mockClear();
});

test("renders the empty state when there are no notices", async () => {
  mocks.notices = [];
  const { default: Component } = await import("~/app/routes/app/inbox");
  render(<Component />);
  expect(screen.getByText("Inbox zero")).toBeInTheDocument();
});

test("renders unread notice with mark read action and invalidates the list", async () => {
  mocks.notices = [
    {
      id: "n1",
      subject: "Hello",
      body: "World",
      kind: "general",
      readAt: null,
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/inbox");
  render(<Component />);
  expect(screen.getByText("Hello")).toBeInTheDocument();
  expect(screen.getByText("World")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Mark read/ }));
  expect(mocks.markReadMutate).toHaveBeenCalledWith({ id: "n1" });
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["notice", "list"],
  });
});

test("clicking Mark all read triggers markAllRead and invalidates the list", async () => {
  mocks.notices = [
    {
      id: "n1",
      subject: "x",
      body: null,
      kind: "general",
      readAt: null,
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/inbox");
  render(<Component />);
  fireEvent.click(screen.getByRole("button", { name: /Mark all read/ }));
  expect(mocks.markAllReadMutate).toHaveBeenCalled();
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["notice", "list"],
  });
});

test("does not show mutation actions when user cannot mutate", async () => {
  mocks.notices = [
    {
      id: "n1",
      subject: "x",
      body: null,
      kind: "general",
      readAt: null,
      createdAt: new Date(),
    },
  ];
  mocks.canMutate = false;
  const { default: Component } = await import("~/app/routes/app/inbox");
  render(<Component />);
  expect(
    screen.queryByRole("button", { name: /Mark all read/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Mark read/ }),
  ).not.toBeInTheDocument();
});

test("hides Mark all read when there are no unread notices", async () => {
  mocks.notices = [
    {
      id: "n1",
      subject: "x",
      body: null,
      kind: "general",
      readAt: new Date(),
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/inbox");
  render(<Component />);
  expect(
    screen.queryByRole("button", { name: /Mark all read/ }),
  ).not.toBeInTheDocument();
});
