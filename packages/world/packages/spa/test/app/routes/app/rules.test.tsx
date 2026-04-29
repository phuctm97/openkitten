import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

type MutationOptions = {
  _kind?: string;
  onSuccess?: () => Promise<void> | void;
};

const mocks = vi.hoisted(() => ({
  rules: undefined as unknown,
  canMutate: true,
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  createIsPending: false,
  invalidateQueries: vi.fn(async () => {}),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: mocks.rules }),
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
    useMutation: (options: MutationOptions) => {
      const target =
        options._kind === "update" ? mocks.updateMutate : mocks.createMutate;
      const mutate = (input: unknown) => {
        target(input);
        void options.onSuccess?.();
      };
      return {
        mutate,
        isPending: options._kind === "create" ? mocks.createIsPending : false,
      };
    },
  };
});

vi.mock("~/lib/orpc-utils", () => ({
  orpcUtils: {
    rule: {
      list: {
        queryOptions: () => ({ queryKey: ["rule", "list"] }),
        queryKey: () => ["rule", "list"],
      },
      create: {
        mutationOptions: (opts: MutationOptions) => ({
          ...opts,
          _kind: "create",
        }),
      },
      update: {
        mutationOptions: (opts: MutationOptions) => ({
          ...opts,
          _kind: "update",
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
  mocks.rules = undefined;
  mocks.canMutate = true;
  mocks.createMutate.mockReset();
  mocks.updateMutate.mockReset();
  mocks.createIsPending = false;
  mocks.invalidateQueries.mockClear();
});

test("renders empty state with admin call to action when user can mutate", async () => {
  mocks.rules = [];
  const { default: Component } = await import("~/app/routes/app/rules");
  render(<Component />);
  expect(screen.getByText("No rules yet")).toBeInTheDocument();
  expect(screen.getByText(/Add your first rule/)).toBeInTheDocument();
});

test("renders empty state member message when user cannot mutate", async () => {
  mocks.rules = [];
  mocks.canMutate = false;
  const { default: Component } = await import("~/app/routes/app/rules");
  render(<Component />);
  expect(
    screen.getByText(/An owner or admin will add the first rule/),
  ).toBeInTheDocument();
});

test("renders an enabled rule with toggle and a disabled rule grayed out", async () => {
  mocks.rules = [
    {
      id: "r1",
      title: "No-loud-meow",
      body: "Quiet hours apply.",
      enabled: true,
      updatedAt: new Date(),
    },
    {
      id: "r2",
      title: "Bedtime",
      body: "Sleep early.",
      enabled: false,
      updatedAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/rules");
  render(<Component />);
  expect(screen.getByText("No-loud-meow")).toBeInTheDocument();
  expect(screen.getByText("Bedtime")).toBeInTheDocument();
  const switches = screen.getAllByRole("switch");
  expect(switches).toHaveLength(2);
});

test("flipping a rule switch calls the update mutation", async () => {
  mocks.rules = [
    {
      id: "r1",
      title: "No-loud-meow",
      body: "Quiet.",
      enabled: false,
      updatedAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/rules");
  render(<Component />);
  fireEvent.click(screen.getByRole("switch"));
  expect(mocks.updateMutate).toHaveBeenCalledWith({
    id: "r1",
    enabled: true,
  });
});

test("renders read-only enable/disable badges when user cannot mutate", async () => {
  mocks.rules = [
    {
      id: "r1",
      title: "No-loud-meow",
      body: "Quiet.",
      enabled: true,
      updatedAt: new Date(),
    },
    {
      id: "r2",
      title: "Bedtime",
      body: "Sleep.",
      enabled: false,
      updatedAt: new Date(),
    },
  ];
  mocks.canMutate = false;
  const { default: Component } = await import("~/app/routes/app/rules");
  render(<Component />);
  expect(screen.getByText("enabled")).toBeInTheDocument();
  expect(screen.getByText("disabled")).toBeInTheDocument();
});

test("submitting the create rule dialog invalidates the rule list", async () => {
  mocks.rules = [];
  const { default: Component } = await import("~/app/routes/app/rules");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /New rule/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Quiet" },
  });
  fireEvent.change(screen.getByLabelText("Rule"), {
    target: { value: "Stay calm." },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  expect(mocks.createMutate).toHaveBeenCalledWith({
    title: "Quiet",
    body: "Stay calm.",
  });
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["rule", "list"],
  });
});

test("toggling a rule invalidates the rule list", async () => {
  mocks.rules = [
    {
      id: "r1",
      title: "X",
      body: "Y",
      enabled: false,
      updatedAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/rules");
  render(<Component />);
  fireEvent.click(screen.getByRole("switch"));
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["rule", "list"],
  });
});

test("renders the pending state on the save button while creating", async () => {
  mocks.rules = [];
  mocks.createIsPending = true;
  const { default: Component } = await import("~/app/routes/app/rules");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /New rule/ })[0] as HTMLElement,
  );
  expect(screen.getByRole("button", { name: /Saving…/ })).toBeInTheDocument();
});
