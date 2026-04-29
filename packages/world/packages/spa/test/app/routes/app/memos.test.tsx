import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

type MutationOptions = {
  _kind?: string;
  onSuccess?: () => Promise<void> | void;
};

const mocks = vi.hoisted(() => ({
  memos: undefined as unknown,
  cats: [] as unknown[],
  canMutate: true,
  createMutate: vi.fn(),
  pinMutate: vi.fn(),
  unpinMutate: vi.fn(),
  createIsPending: false,
  invalidateQueries: vi.fn(async () => {}),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey: [string, string] }) => {
      const [name] = options.queryKey;
      if (name === "memo") return { data: mocks.memos };
      if (name === "cat") return { data: mocks.cats };
      return { data: undefined };
    },
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
    useMutation: (options: MutationOptions) => {
      const kind = options._kind;
      const target =
        kind === "pin"
          ? mocks.pinMutate
          : kind === "unpin"
            ? mocks.unpinMutate
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
    memo: {
      list: {
        queryOptions: () => ({ queryKey: ["memo", "list"] }),
        queryKey: () => ["memo", "list"],
      },
      create: {
        mutationOptions: (opts: MutationOptions) => ({
          ...opts,
          _kind: "create",
        }),
      },
      pin: {
        mutationOptions: (opts: MutationOptions) => ({
          ...opts,
          _kind: "pin",
        }),
      },
      unpin: {
        mutationOptions: (opts: MutationOptions) => ({
          ...opts,
          _kind: "unpin",
        }),
      },
    },
    cat: { list: { queryOptions: () => ({ queryKey: ["cat", "list"] }) } },
  },
}));

vi.mock("~/lib/use-can-mutate", () => ({
  useCanMutate: () => mocks.canMutate,
}));

vi.mock("~/lib/toast-error", () => ({ toastError: vi.fn() }));

vi.mock("~/components/ui/select", () => {
  function Select({
    children,
    onValueChange,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: ReactNode;
  }) {
    return (
      <div data-testid="select">
        {children}
        <button
          type="button"
          data-testid="set-target-house"
          onClick={() => onValueChange?.("__house__")}
        />
        <button
          type="button"
          data-testid="set-target-cat"
          onClick={() => onValueChange?.("c1")}
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
  mocks.memos = undefined;
  mocks.cats = [];
  mocks.canMutate = true;
  mocks.createMutate.mockReset();
  mocks.pinMutate.mockReset();
  mocks.unpinMutate.mockReset();
  mocks.createIsPending = false;
  mocks.invalidateQueries.mockClear();
});

test("renders empty state when there are no memos", async () => {
  mocks.memos = [];
  const { default: Component } = await import("~/app/routes/app/memos");
  render(<Component />);
  expect(screen.getByText("No memos yet")).toBeInTheDocument();
});

test("renders empty state member message when user cannot mutate", async () => {
  mocks.memos = [];
  mocks.canMutate = false;
  const { default: Component } = await import("~/app/routes/app/memos");
  render(<Component />);
  expect(
    screen.getByText(/An owner or admin will add the first memo/),
  ).toBeInTheDocument();
});

test("renders a pinned cat-targeted memo and triggers unpin", async () => {
  mocks.cats = [{ id: "c1", name: "Misty" }];
  mocks.memos = [
    {
      id: "m1",
      body: "Steer this cat",
      pinnedAt: new Date(),
      targetCatId: "c1",
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/memos");
  render(<Component />);
  expect(screen.getByText("Steer this cat")).toBeInTheDocument();
  expect(screen.getByText("Pinned")).toBeInTheDocument();
  expect(screen.getByText("Misty")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Unpin/ }));
  expect(mocks.unpinMutate).toHaveBeenCalledWith({ id: "m1" });
});

test("renders an unpinned house memo and triggers pin", async () => {
  mocks.memos = [
    {
      id: "m1",
      body: "Whole house note",
      pinnedAt: null,
      targetCatId: null,
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/memos");
  render(<Component />);
  expect(screen.getByText("Whole house")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Pin$/ }));
  expect(mocks.pinMutate).toHaveBeenCalledWith({ id: "m1" });
});

test("submitting the new memo dialog calls create with whole-house target", async () => {
  mocks.memos = [];
  const { default: Component } = await import("~/app/routes/app/memos");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /Write memo/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Memo"), {
    target: { value: "Be calm" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  expect(mocks.createMutate).toHaveBeenCalledWith({
    body: "Be calm",
    targetCatId: null,
  });
});

test("falls back to Cat label when target id has no matching cat", async () => {
  mocks.cats = [];
  mocks.memos = [
    {
      id: "m1",
      body: "Note",
      pinnedAt: null,
      targetCatId: "missing",
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/memos");
  render(<Component />);
  expect(screen.getByText("Cat")).toBeInTheDocument();
});

test("create memo invalidates the memo list on success", async () => {
  mocks.memos = [];
  const { default: Component } = await import("~/app/routes/app/memos");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /Write memo/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Memo"), {
    target: { value: "Note" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["memo", "list"],
  });
});

test("pin and unpin mutations both invalidate the memo list", async () => {
  mocks.memos = [
    {
      id: "m1",
      body: "First",
      pinnedAt: null,
      targetCatId: null,
      createdAt: new Date(),
    },
  ];
  const { default: Component, ...rest } = await import(
    "~/app/routes/app/memos"
  );
  void rest;
  const { rerender } = render(<Component />);
  fireEvent.click(screen.getByRole("button", { name: /^Pin$/ }));
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["memo", "list"],
  });
  mocks.invalidateQueries.mockClear();
  mocks.memos = [
    {
      id: "m1",
      body: "First",
      pinnedAt: new Date(),
      targetCatId: null,
      createdAt: new Date(),
    },
  ];
  rerender(<Component />);
  fireEvent.click(screen.getByRole("button", { name: /Unpin/ }));
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["memo", "list"],
  });
});

test("submitting with a cat target sends the cat id", async () => {
  mocks.memos = [];
  mocks.cats = [{ id: "c1", name: "Misty" }];
  const { default: Component } = await import("~/app/routes/app/memos");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /Write memo/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Memo"), {
    target: { value: "For Misty" },
  });
  fireEvent.click(screen.getByTestId("set-target-cat"));
  fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  expect(mocks.createMutate).toHaveBeenCalledWith({
    body: "For Misty",
    targetCatId: "c1",
  });
});

test("renders gracefully when the cat list query has no data", async () => {
  mocks.memos = [
    {
      id: "m1",
      body: "Note",
      pinnedAt: null,
      targetCatId: null,
      createdAt: new Date(),
    },
  ];
  mocks.cats = undefined as never;
  const { default: Component } = await import("~/app/routes/app/memos");
  render(<Component />);
  expect(screen.getByText("Note")).toBeInTheDocument();
});

test("renders the pending state on the save button while creating", async () => {
  mocks.memos = [];
  mocks.createIsPending = true;
  const { default: Component } = await import("~/app/routes/app/memos");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /Write memo/ })[0] as HTMLElement,
  );
  expect(screen.getByRole("button", { name: /Saving…/ })).toBeInTheDocument();
});
