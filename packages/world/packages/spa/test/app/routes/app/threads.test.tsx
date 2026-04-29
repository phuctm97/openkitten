import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

type MutationOptions = {
  _kind?: string;
  onSuccess?: () => Promise<void> | void;
};

const mocks = vi.hoisted(() => ({
  threads: undefined as unknown,
  cats: [] as unknown[],
  goals: [] as unknown[],
  canMutate: true,
  createMutate: vi.fn(),
  closeMutate: vi.fn(),
  reopenMutate: vi.fn(),
  createIsPending: false,
  invalidateQueries: vi.fn(async () => {}),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey: [string, string] }) => {
      const [name] = options.queryKey;
      if (name === "thread") return { data: mocks.threads };
      if (name === "cat") return { data: mocks.cats };
      if (name === "goal") return { data: mocks.goals };
      return { data: undefined };
    },
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
    useMutation: (options: MutationOptions) => {
      const kind = options._kind;
      const target =
        kind === "close"
          ? mocks.closeMutate
          : kind === "reopen"
            ? mocks.reopenMutate
            : mocks.createMutate;
      const mutate = (input: unknown) => {
        target(input);
        void options.onSuccess?.();
      };
      return {
        mutate,
        isPending: kind === "create" ? mocks.createIsPending : false,
      };
    },
  };
});

vi.mock("~/lib/orpc-utils", () => ({
  orpcUtils: {
    thread: {
      list: {
        queryOptions: () => ({ queryKey: ["thread", "list"] }),
        queryKey: () => ["thread", "list"],
      },
      create: {
        mutationOptions: (opts: MutationOptions) => ({
          ...opts,
          _kind: "create",
        }),
      },
      close: {
        mutationOptions: (opts: MutationOptions) => ({
          ...opts,
          _kind: "close",
        }),
      },
      reopen: {
        mutationOptions: (opts: MutationOptions) => ({
          ...opts,
          _kind: "reopen",
        }),
      },
    },
    cat: { list: { queryOptions: () => ({ queryKey: ["cat", "list"] }) } },
    goal: { list: { queryOptions: () => ({ queryKey: ["goal", "list"] }) } },
  },
}));

vi.mock("~/lib/use-can-mutate", () => ({
  useCanMutate: () => mocks.canMutate,
}));

vi.mock("~/lib/toast-error", () => ({ toastError: vi.fn() }));

vi.mock("~/components/ui/select", () => {
  function Select({
    children,
    value,
    onValueChange,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: ReactNode;
  }) {
    return (
      <div data-testid="select" data-value={value ?? ""}>
        {children}
        <button
          type="button"
          data-testid="set-none"
          onClick={() => onValueChange?.("__none__")}
        />
        <button
          type="button"
          data-testid="set-c1"
          onClick={() => onValueChange?.("c1")}
        />
        <button
          type="button"
          data-testid="set-g1"
          onClick={() => onValueChange?.("g1")}
        />
      </div>
    );
  }
  function pass({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }
  function SelectItem({
    children,
    ...rest
  }: { children?: ReactNode } & ComponentProps<"div">) {
    return <div {...rest}>{children}</div>;
  }
  return {
    Select,
    SelectContent: pass,
    SelectItem,
    SelectTrigger: pass,
    SelectValue: pass,
  };
});

afterEach(() => {
  mocks.threads = undefined;
  mocks.cats = [];
  mocks.goals = [];
  mocks.canMutate = true;
  mocks.createMutate.mockReset();
  mocks.closeMutate.mockReset();
  mocks.reopenMutate.mockReset();
  mocks.createIsPending = false;
  mocks.invalidateQueries.mockClear();
});

test("renders empty state when there are no threads", async () => {
  mocks.threads = [];
  const { default: Component } = await import("~/app/routes/app/threads");
  render(<Component />);
  expect(screen.getByText("No threads yet")).toBeInTheDocument();
});

test("renders empty state member message when user cannot mutate", async () => {
  mocks.threads = [];
  mocks.canMutate = false;
  const { default: Component } = await import("~/app/routes/app/threads");
  render(<Component />);
  expect(
    screen.getByText(/An owner or admin will open the first thread/),
  ).toBeInTheDocument();
});

test("renders an open thread and triggers close mutation", async () => {
  mocks.cats = [{ id: "c1", name: "Misty" }];
  mocks.threads = [
    {
      id: "t1",
      title: "Refactor",
      summary: "Trim onboarding.",
      status: "open",
      assignedCatId: "c1",
      goalId: "g1",
      updatedAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/threads");
  render(<Component />);
  expect(screen.getByText("Refactor")).toBeInTheDocument();
  expect(screen.getByText("Trim onboarding.")).toBeInTheDocument();
  expect(screen.getByText("Linked to a goal")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Close/ }));
  expect(mocks.closeMutate).toHaveBeenCalledWith({ id: "t1" });
});

test("renders a closed thread and triggers reopen mutation", async () => {
  mocks.threads = [
    {
      id: "t1",
      title: "Done",
      summary: null,
      status: "closed",
      assignedCatId: null,
      goalId: null,
      updatedAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/threads");
  render(<Component />);
  fireEvent.click(screen.getByRole("button", { name: /Reopen/ }));
  expect(mocks.reopenMutate).toHaveBeenCalledWith({ id: "t1" });
});

test("submitting the new thread dialog calls create with selected ids", async () => {
  mocks.threads = [];
  mocks.cats = [{ id: "c1", name: "Misty" }];
  mocks.goals = [{ id: "g1", title: "Goal" }];
  const { default: Component } = await import("~/app/routes/app/threads");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /New thread/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Refactor" },
  });
  fireEvent.change(screen.getByLabelText("Summary"), {
    target: { value: "Trim." },
  });
  fireEvent.click(screen.getByRole("button", { name: /Open thread/ }));
  expect(mocks.createMutate).toHaveBeenCalledWith({
    title: "Refactor",
    summary: "Trim.",
    assignedCatId: null,
    goalId: null,
  });
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["thread", "list"],
  });
});

test("close and reopen mutations both invalidate the thread list", async () => {
  mocks.threads = [
    {
      id: "t1",
      title: "T",
      summary: null,
      status: "open",
      assignedCatId: null,
      goalId: null,
      updatedAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/threads");
  const { rerender } = render(<Component />);
  fireEvent.click(screen.getByRole("button", { name: /Close/ }));
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["thread", "list"],
  });
  mocks.invalidateQueries.mockClear();
  mocks.threads = [
    {
      id: "t1",
      title: "T",
      summary: null,
      status: "closed",
      assignedCatId: null,
      goalId: null,
      updatedAt: new Date(),
    },
  ];
  rerender(<Component />);
  fireEvent.click(screen.getByRole("button", { name: /Reopen/ }));
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["thread", "list"],
  });
});

test("submits with selected cat and goal ids when chosen via the selects", async () => {
  mocks.threads = [];
  mocks.cats = [{ id: "c1", name: "Misty" }];
  mocks.goals = [{ id: "g1", title: "Goal" }];
  const { default: Component } = await import("~/app/routes/app/threads");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /New thread/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Refactor" },
  });
  const setC1 = screen.getAllByTestId("set-c1");
  fireEvent.click(setC1[0] as HTMLElement);
  const setG1 = screen.getAllByTestId("set-g1");
  fireEvent.click(setG1[1] as HTMLElement);
  fireEvent.click(screen.getByRole("button", { name: /Open thread/ }));
  expect(mocks.createMutate).toHaveBeenCalledWith({
    title: "Refactor",
    summary: null,
    assignedCatId: "c1",
    goalId: "g1",
  });
});

test("falls back to 'Cat' label when assigned cat is missing from the list", async () => {
  mocks.threads = [
    {
      id: "t1",
      title: "T",
      summary: null,
      status: "open",
      assignedCatId: "missing",
      goalId: null,
      updatedAt: new Date(),
    },
  ];
  mocks.cats = [];
  const { default: Component } = await import("~/app/routes/app/threads");
  render(<Component />);
  expect(screen.getByText("Cat")).toBeInTheDocument();
});

test("renders gracefully when the cat list query has no data", async () => {
  mocks.threads = [
    {
      id: "t1",
      title: "T",
      summary: null,
      status: "open",
      assignedCatId: null,
      goalId: null,
      updatedAt: new Date(),
    },
  ];
  mocks.cats = undefined as never;
  const { default: Component } = await import("~/app/routes/app/threads");
  render(<Component />);
  expect(screen.getByText("T")).toBeInTheDocument();
});

test("submits an empty summary as null", async () => {
  mocks.threads = [];
  const { default: Component } = await import("~/app/routes/app/threads");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /New thread/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "X" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Open thread/ }));
  expect(mocks.createMutate).toHaveBeenCalledWith({
    title: "X",
    summary: null,
    assignedCatId: null,
    goalId: null,
  });
});

test("renders the pending state on the open thread button", async () => {
  mocks.threads = [];
  mocks.createIsPending = true;
  const { default: Component } = await import("~/app/routes/app/threads");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /New thread/ })[0] as HTMLElement,
  );
  expect(screen.getByRole("button", { name: /Opening…/ })).toBeInTheDocument();
});
