import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

type MutationOptions = { onSuccess?: () => Promise<void> | void };

const mocks = vi.hoisted(() => ({
  cats: undefined as unknown,
  canMutate: true,
  createMutate: vi.fn(),
  createIsPending: false,
  invalidateQueries: vi.fn(async () => {}),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: mocks.cats }),
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
    useMutation: (options: MutationOptions) => ({
      mutate: (input: unknown) => {
        mocks.createMutate(input);
        void options.onSuccess?.();
      },
      isPending: mocks.createIsPending,
    }),
  };
});

vi.mock("~/lib/orpc-utils", () => ({
  orpcUtils: {
    cat: {
      list: {
        queryOptions: () => ({ queryKey: ["cat", "list"] }),
        queryKey: () => ["cat", "list"],
      },
      create: {
        mutationOptions: (opts: MutationOptions) => opts,
      },
    },
  },
}));

vi.mock("~/lib/use-can-mutate", () => ({
  useCanMutate: () => mocks.canMutate,
}));

vi.mock("~/lib/toast-error", () => ({ toastError: vi.fn() }));

afterEach(() => {
  mocks.cats = undefined;
  mocks.canMutate = true;
  mocks.createMutate.mockReset();
  mocks.createIsPending = false;
  mocks.invalidateQueries.mockClear();
});

test("renders the empty state when there are no cats and user can mutate", async () => {
  mocks.cats = [];
  const { default: Component } = await import("~/app/routes/app/cats");
  render(<Component />);
  expect(screen.getByText("No cats yet")).toBeInTheDocument();
  expect(screen.getByText(/Adopt your first cat/)).toBeInTheDocument();
});

test("renders a member-only message when the user cannot mutate", async () => {
  mocks.cats = [];
  mocks.canMutate = false;
  const { default: Component } = await import("~/app/routes/app/cats");
  render(<Component />);
  expect(
    screen.getByText(/An owner or admin will adopt the first cat/),
  ).toBeInTheDocument();
});

test("renders a cat card with name, slug, description, and resting icon", async () => {
  mocks.cats = [
    {
      id: "c1",
      name: "Misty",
      slug: "misty",
      description: "A calm one",
      isResting: true,
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/cats");
  render(<Component />);
  expect(screen.getByText("Misty")).toBeInTheDocument();
  expect(screen.getByText("misty")).toBeInTheDocument();
  expect(screen.getByText("A calm one")).toBeInTheDocument();
});

test("renders an awake cat without description", async () => {
  mocks.cats = [
    {
      id: "c1",
      name: "Sage",
      slug: "sage",
      description: null,
      isResting: false,
      createdAt: new Date(),
    },
  ];
  const { default: Component } = await import("~/app/routes/app/cats");
  render(<Component />);
  expect(screen.getByText("Sage")).toBeInTheDocument();
});

test("submitting the adopt dialog calls the create mutation and invalidates the cat list", async () => {
  mocks.cats = [];
  const { default: Component } = await import("~/app/routes/app/cats");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /Adopt cat/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Misty" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Calm" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Adopt$/ }));
  expect(mocks.createMutate).toHaveBeenCalledWith({
    name: "Misty",
    description: "Calm",
  });
  await Promise.resolve();
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["cat", "list"],
  });
});

test("submits with empty description as null", async () => {
  mocks.cats = [];
  const { default: Component } = await import("~/app/routes/app/cats");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /Adopt cat/ })[0] as HTMLElement,
  );
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Sage" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Adopt$/ }));
  expect(mocks.createMutate).toHaveBeenCalledWith({
    name: "Sage",
    description: null,
  });
});

test("renders the pending state on the adopt button while the mutation is in flight", async () => {
  mocks.cats = [];
  mocks.createIsPending = true;
  const { default: Component } = await import("~/app/routes/app/cats");
  render(<Component />);
  fireEvent.click(
    screen.getAllByRole("button", { name: /Adopt cat/ })[0] as HTMLElement,
  );
  expect(screen.getByRole("button", { name: /Adopting…/ })).toBeInTheDocument();
});
