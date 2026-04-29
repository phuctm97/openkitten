import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("~/lib/authenticate", () => ({
  authenticate: mocks.authenticate,
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("~/components/ui/tabs", () => {
  type TabsProps = {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: ReactNode;
  };
  function Tabs({ children, value, onValueChange }: TabsProps) {
    return (
      <div data-testid="tabs" data-value={value}>
        {children}
        <button
          type="button"
          data-testid="trigger-account"
          onClick={() => onValueChange?.("account")}
        />
        <button
          type="button"
          data-testid="trigger-security"
          onClick={() => onValueChange?.("security")}
        />
        <button
          type="button"
          data-testid="trigger-unknown"
          onClick={() => onValueChange?.("unknown")}
        />
      </div>
    );
  }
  function TabsList({ children }: { children?: ReactNode }) {
    return <div data-testid="tabs-list">{children}</div>;
  }
  function TabsTrigger({
    children,
    value,
    ...rest
  }: { value?: string } & ComponentProps<"button">) {
    return (
      <button type="button" role="tab" data-value={value} {...rest}>
        {children}
      </button>
    );
  }
  return { Tabs, TabsList, TabsTrigger };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.navigate.mockReset();
});

function renderRoute(initialPath: string, ChildComponent?: () => ReactNode) {
  return import("~/app/routes/settings").then(({ default: Component }) => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/settings" element={<Component />}>
            <Route
              path="account"
              element={ChildComponent ? <ChildComponent /> : <Outlet />}
            />
            <Route
              path="security"
              element={ChildComponent ? <ChildComponent /> : <Outlet />}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  });
}

test("clientLoader authenticates and returns null when on a child path", async () => {
  mocks.authenticate.mockResolvedValueOnce(undefined);
  const { clientLoader } = await import("~/app/routes/settings");
  await expect(
    clientLoader({
      request: new Request("http://localhost/settings/account"),
    } as never),
  ).resolves.toBeNull();
});

test("clientLoader redirects /settings to /settings/account", async () => {
  mocks.authenticate.mockResolvedValueOnce(undefined);
  const { clientLoader } = await import("~/app/routes/settings");
  await expect(
    clientLoader({
      request: new Request("http://localhost/settings"),
    } as never),
  ).rejects.toMatchObject({ status: 302 });
});

test("clientLoader redirects /settings/ (with trailing slash) to /settings/account", async () => {
  mocks.authenticate.mockResolvedValueOnce(undefined);
  const { clientLoader } = await import("~/app/routes/settings");
  await expect(
    clientLoader({
      request: new Request("http://localhost/settings/"),
    } as never),
  ).rejects.toMatchObject({ status: 302 });
});

test("renders the Account heading and breadcrumb on /settings/account", async () => {
  await renderRoute("/settings/account", () => <div data-testid="child" />);
  expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
  expect(
    screen.getByText("Manage your profile, email, and avatar."),
  ).toBeInTheDocument();
  expect(screen.getByTestId("child")).toBeInTheDocument();
});

test("renders the Security heading and breadcrumb on /settings/security", async () => {
  await renderRoute("/settings/security", () => <div data-testid="child" />);
  expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
  expect(
    screen.getByText("Update your password and connected sign-in methods."),
  ).toBeInTheDocument();
});

test("clicking the Security tab calls navigate with /settings/security", async () => {
  await renderRoute("/settings/account", () => <div data-testid="child" />);
  fireEvent.click(screen.getByTestId("trigger-security"));
  expect(mocks.navigate).toHaveBeenCalledWith("/settings/security");
});

test("changing tab to an unknown value does not navigate", async () => {
  await renderRoute("/settings/account", () => <div data-testid="child" />);
  fireEvent.click(screen.getByTestId("trigger-unknown"));
  expect(mocks.navigate).not.toHaveBeenCalled();
});
