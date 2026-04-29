import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

type MutationOptions = {
  _kind?: string;
  onSuccess?: () => Promise<void> | void;
};

const mocks = vi.hoisted(() => ({
  goals: undefined as unknown,
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
    useQuery: () => ({ data: mocks.goals }),
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
    goal: {
      list: {
        queryOptions: () => ({ queryKey: ["goal", "list"] }),
        queryKey: () => ["goal", "list"],
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
  mocks.goals = undefined;
  mocks.canMutate = true;
  mocks.createMutate.mockReset();
  mocks.updateMutate.mockReset();
  mocks.createIsPending = false;
  mocks.invalidateQueries.mockClear();
});

test("renders empty state with admin call to action", async () => {
  mocks.goals = [];
  const { default: Component } = await import("~/app/routes/app/goals");
  render(<Component />);
  expect(screen.getByText("No goals yet")).toBeInTheDocument();
});

test("renders empty state member message when user cannot mutate", async () => {
  mocks.goals = [];
  mocks.canMutate = false;
  const { default: Component } = await import("~/app/routes/app/goals");
  render(<Component />);
  expect(
    screen.getByText(/An owner or admin will set the first goal/),
  ).toBeInTheDocument();
});

test("renders an active goal with mark achieved action", async () => {
  mocks.goals = [
    {
      id: "g1",
      title: "Onboard",
      description: "Welcome new users.",
      status: "active",
      achievedAt: null,
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/goals");
  render(<Component />);
  expect(screen.getByText("Onboard")).toBeInTheDocument();
  expect(screen.getByText("Welcome new users.")).toBeInTheDocument();
  expect(screen.getByText("active")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Mark achieved/ }));
  expect(mocks.updateMutate).toHaveBeenCalled();
});

test("renders an achieved goal without mark achieved action", async () => {
  mocks.goals = [
    {
      id: "g1",
      title: "Done",
      description: null,
      status: "achieved",
      achievedAt: new Date(),
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/goals");
  render(<Component />);
  expect(screen.getByText("Done")).toBeInTheDocument();
  expect(screen.getByText("achieved")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Mark achieved/ }),
  ).not.toBeInTheDocument();
});

test("submitting the new goal dialog calls create with trimmed values", async () => {
  mocks.goals = [];
  const { default: Component } = await import("~/app/routes/app/goals");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /New goal/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: " Onboard " },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: " Help " },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  expect(mocks.createMutate).toHaveBeenCalledWith({
    title: "Onboard",
    description: "Help",
  });
});

test("submitting the new goal dialog with empty description sends null", async () => {
  mocks.goals = [];
  const { default: Component } = await import("~/app/routes/app/goals");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /New goal/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Onboard" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  expect(mocks.createMutate).toHaveBeenCalledWith({
    title: "Onboard",
    description: null,
  });
});

test("does not show mark achieved when user cannot mutate", async () => {
  mocks.goals = [
    {
      id: "g1",
      title: "X",
      description: null,
      status: "active",
      achievedAt: null,
      createdAt: new Date(),
    },
  ];
  mocks.canMutate = false;
  const { default: Component } = await import("~/app/routes/app/goals");
  render(<Component />);
  expect(
    screen.queryByRole("button", { name: /Mark achieved/ }),
  ).not.toBeInTheDocument();
});

test("create goal mutation invalidates the goal list on success", async () => {
  mocks.goals = [];
  const { default: Component } = await import("~/app/routes/app/goals");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /New goal/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Onboard" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["goal", "list"],
  });
});

test("mark achieved mutation invalidates the goal list on success", async () => {
  mocks.goals = [
    {
      id: "g1",
      title: "X",
      description: null,
      status: "active",
      achievedAt: null,
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/goals");
  render(<Component />);
  fireEvent.click(screen.getByRole("button", { name: /Mark achieved/ }));
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["goal", "list"],
  });
});

test("renders the pending state on the save button while creating", async () => {
  mocks.goals = [];
  mocks.createIsPending = true;
  const { default: Component } = await import("~/app/routes/app/goals");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /New goal/ })[0] as HTMLElement,
  );
  expect(screen.getByRole("button", { name: /Saving…/ })).toBeInTheDocument();
});
