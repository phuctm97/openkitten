import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  useSession: vi.fn(),
  organization: {
    listMembers: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
  },
}));

const queryClientMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/auth-client", () => ({ authClient: authClientMock }));
vi.mock("~/lib/query-client", () => ({ queryClient: queryClientMock }));
vi.mock("~/lib/toast-error", () => ({ toastError: toastErrorMock }));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: vi.fn() },
}));

vi.mock("~/components/auth/invite-member-dialog", () => ({
  InviteMemberDialog: ({
    open,
    onOpenChange,
  }: {
    organizationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="invite-dialog">
        <button
          type="button"
          data-testid="invite-close"
          onClick={() => onOpenChange(false)}
        />
      </div>
    ) : null,
}));

vi.mock("~/components/ui/select", async () => {
  return {
    Select: ({
      value,
      onValueChange,
      disabled,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      disabled?: boolean;
      children: ReactNode;
    }) => (
      <div
        data-testid="select"
        data-value={value}
        data-disabled={String(disabled ?? false)}
      >
        <button
          type="button"
          data-testid={`select-${value}-set-admin`}
          onClick={() => onValueChange("admin")}
        />
        <button
          type="button"
          data-testid={`select-${value}-set-owner`}
          onClick={() => onValueChange("owner")}
        />
        {children}
      </div>
    ),
    SelectContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: ReactNode;
    }) => <div data-testid={`select-item-${value}`}>{children}</div>,
    SelectTrigger: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SelectValue: ({ children }: { children?: ReactNode }) => (
      <span data-testid="select-value">{children}</span>
    ),
  };
});

vi.mock("~/components/ui/alert-dialog", async () => {
  return {
    AlertDialog: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogTrigger: ({
      children,
    }: {
      asChild?: boolean;
      children: ReactNode;
    }) => <>{children}</>,
    AlertDialogContent: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogDescription: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogFooter: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogHeader: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogTitle: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogAction: ({
      onClick,
      children,
    }: {
      onClick?: () => void;
      children: ReactNode;
    }) => (
      <button type="button" onClick={onClick} data-testid="alert-action">
        {children}
      </button>
    ),
    AlertDialogCancel: ({ children }: { children: ReactNode }) => (
      <button type="button">{children}</button>
    ),
  };
});

const { OrganizationMembersCard } = await import(
  "~/components/auth/organization-members-card"
);

type Member = {
  id: string;
  role: string;
  createdAt: Date;
  user: { id: string; name: string; email: string; image?: string };
};

function renderCard(opts: {
  orgId: string;
  members?: Member[];
  currentUserId?: string;
  isLoading?: boolean;
}) {
  authClientMock.useSession.mockReturnValue({
    data: opts.currentUserId ? { user: { id: opts.currentUserId } } : null,
  });
  authClientMock.organization.listMembers.mockResolvedValue({
    members: opts.members ?? [],
  });

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
  if (!opts.isLoading) {
    client.setQueryData(["organizations", "members", opts.orgId], {
      members: opts.members ?? [],
    });
  }
  return render(
    <QueryClientProvider client={client}>
      <OrganizationMembersCard organizationId={opts.orgId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authClientMock.useSession.mockReset();
  authClientMock.organization.listMembers.mockReset();
  authClientMock.organization.updateMemberRole.mockReset();
  authClientMock.organization.removeMember.mockReset();
  queryClientMock.invalidateQueries.mockReset();
  queryClientMock.invalidateQueries.mockResolvedValue(undefined);
  toastErrorMock.mockReset();
  toastSuccessMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

test("renders loading spinner while members load", async () => {
  authClientMock.useSession.mockReturnValue({ data: null });
  authClientMock.organization.listMembers.mockResolvedValue({ members: [] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <OrganizationMembersCard organizationId="org_1" />
    </QueryClientProvider>,
  );

  expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
});

test("renders empty state when no members", async () => {
  renderCard({ orgId: "org_1", members: [] });
  expect(screen.getByText("No members yet")).toBeInTheDocument();
  expect(
    screen.getByText("Invite teammates to start collaborating."),
  ).toBeInTheDocument();
});

test("renders members and toggles invite dialog", async () => {
  renderCard({
    orgId: "org_1",
    currentUserId: "user_self",
    members: [
      {
        id: "m_1",
        role: "owner",
        createdAt: new Date("2025-01-01"),
        user: {
          id: "user_self",
          name: "Self User",
          email: "self@example.com",
          image: "https://img.example/self",
        },
      },
      {
        id: "m_2",
        role: "member",
        createdAt: new Date("2025-02-01"),
        user: {
          id: "user_2",
          name: "Bob Builder",
          email: "bob@example.com",
        },
      },
      {
        id: "m_3",
        role: "weird",
        createdAt: new Date("2025-03-01"),
        user: {
          id: "user_3",
          name: "  ",
          email: "blank@example.com",
        },
      },
    ],
  });

  expect(screen.getByText("Self User")).toBeInTheDocument();
  expect(screen.getByText("Bob Builder")).toBeInTheDocument();
  expect(screen.getByText("?")).toBeInTheDocument();
  expect(screen.getByText("weird")).toBeInTheDocument();
  expect(screen.getAllByText(/Member|Owner/)[0]).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Invite member/ }));
  expect(screen.getByTestId("invite-dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("invite-close"));
  expect(screen.queryByTestId("invite-dialog")).toBeNull();
});

test("disables role select for self and owner; updates role for editable members", async () => {
  let resolveUpdate: (value: unknown) => void = () => {};
  authClientMock.organization.updateMemberRole.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveUpdate = resolve;
    }),
  );
  renderCard({
    orgId: "org_1",
    currentUserId: "user_self",
    members: [
      {
        id: "m_1",
        role: "owner",
        createdAt: new Date("2025-01-01"),
        user: { id: "user_owner", name: "Owner User", email: "o@e" },
      },
      {
        id: "m_2",
        role: "member",
        createdAt: new Date("2025-02-01"),
        user: { id: "user_self", name: "Self", email: "s@e" },
      },
      {
        id: "m_3",
        role: "admin",
        createdAt: new Date("2025-03-01"),
        user: { id: "user_other", name: "Other", email: "x@e" },
      },
    ],
  });

  const selects = screen.getAllByTestId("select");
  expect(selects[0]).toHaveAttribute("data-disabled", "true");
  expect(selects[1]).toHaveAttribute("data-disabled", "true");
  expect(selects[2]).toHaveAttribute("data-disabled", "false");

  fireEvent.click(screen.getByTestId("select-admin-set-admin"));

  await waitFor(() => {
    expect(authClientMock.organization.updateMemberRole).toHaveBeenCalledWith({
      memberId: "m_3",
      role: "admin",
      fetchOptions: { throw: true },
    });
  });

  resolveUpdate({ data: {} });
  await waitFor(() => {
    expect(toastSuccessMock).toHaveBeenCalledWith("Role updated");
  });
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["organizations", "members", "org_1"],
  });
});

test("ignores role updates for non-assignable values", async () => {
  renderCard({
    orgId: "org_1",
    currentUserId: "user_self",
    members: [
      {
        id: "m_3",
        role: "admin",
        createdAt: new Date("2025-01-01"),
        user: { id: "user_other", name: "Other", email: "x@e" },
      },
    ],
  });

  fireEvent.click(screen.getByTestId("select-admin-set-owner"));
  expect(authClientMock.organization.updateMemberRole).not.toHaveBeenCalled();
});

test("toasts error when role update fails", async () => {
  authClientMock.organization.updateMemberRole.mockRejectedValueOnce(
    new Error("nope"),
  );
  renderCard({
    orgId: "org_1",
    currentUserId: "user_self",
    members: [
      {
        id: "m_3",
        role: "member",
        createdAt: new Date("2025-01-01"),
        user: { id: "user_other", name: "Other", email: "x@e" },
      },
    ],
  });

  fireEvent.click(screen.getByTestId("select-member-set-admin"));

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});

test("removes a non-self member via alert dialog action", async () => {
  authClientMock.organization.removeMember.mockResolvedValueOnce({ data: {} });
  renderCard({
    orgId: "org_1",
    currentUserId: "user_self",
    members: [
      {
        id: "m_3",
        role: "member",
        createdAt: new Date("2025-01-01"),
        user: { id: "user_other", name: "Other", email: "x@e" },
      },
    ],
  });

  fireEvent.click(screen.getByTestId("alert-action"));

  await waitFor(() => {
    expect(authClientMock.organization.removeMember).toHaveBeenCalledWith({
      memberIdOrEmail: "m_3",
      fetchOptions: { throw: true },
    });
  });
  await waitFor(() => {
    expect(toastSuccessMock).toHaveBeenCalledWith("Member removed");
  });
  expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["organizations", "members", "org_1"],
  });
});

test("toasts error when remove fails", async () => {
  authClientMock.organization.removeMember.mockRejectedValueOnce(
    new Error("nope"),
  );
  renderCard({
    orgId: "org_1",
    currentUserId: "user_self",
    members: [
      {
        id: "m_3",
        role: "member",
        createdAt: new Date("2025-01-01"),
        user: { id: "user_other", name: "Other", email: "x@e" },
      },
    ],
  });

  fireEvent.click(screen.getByTestId("alert-action"));

  await waitFor(() => {
    expect(toastErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
});

test("session without user data falls through with undefined currentUserId", async () => {
  authClientMock.useSession.mockReturnValue({ data: null });
  authClientMock.organization.listMembers.mockResolvedValue({
    members: [
      {
        id: "m_1",
        role: "member",
        createdAt: new Date("2025-01-01"),
        user: { id: "u1", name: "Person", email: "p@e" },
      },
    ],
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
  client.setQueryData(["organizations", "members", "org_1"], {
    members: [
      {
        id: "m_1",
        role: "member",
        createdAt: new Date("2025-01-01"),
        user: { id: "u1", name: "Person", email: "p@e" },
      },
    ],
  });
  render(
    <QueryClientProvider client={client}>
      <OrganizationMembersCard organizationId="org_1" />
    </QueryClientProvider>,
  );

  expect(screen.getByText("Person")).toBeInTheDocument();
  expect(screen.getByTestId("alert-action")).toBeInTheDocument();
});

test("renders members with no data (data falsy → empty array)", async () => {
  authClientMock.useSession.mockReturnValue({ data: null });
  authClientMock.organization.listMembers.mockResolvedValue(null);
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
  client.setQueryData(["organizations", "members", "org_1"], null);
  render(
    <QueryClientProvider client={client}>
      <OrganizationMembersCard organizationId="org_1" />
    </QueryClientProvider>,
  );
  expect(screen.getByText("No members yet")).toBeInTheDocument();
});
