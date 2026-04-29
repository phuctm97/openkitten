import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  loaderData: { invitationId: "inv_1" } as { invitationId: string },
}));

vi.mock("~/lib/authenticate", () => ({
  authenticate: mocks.authenticate,
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useLoaderData: () => mocks.loaderData,
  };
});

vi.mock("~/components/auth/accept-invitation-card", () => ({
  AcceptInvitationCard: ({
    invitationId,
    className,
  }: {
    invitationId: string;
    className?: string;
  }) => (
    <div
      data-testid="accept-invitation-card"
      data-invitation-id={invitationId}
      data-class={className}
    />
  ),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

test("clientLoader throws a 404 when no invitationId is in the URL", async () => {
  mocks.authenticate.mockResolvedValueOnce(undefined);
  const { clientLoader } = await import("~/app/routes/accept-invitation");

  await expect(
    clientLoader({
      request: new Request("http://localhost/accept-invitation"),
    } as never),
  ).rejects.toMatchObject({ init: { status: 404 } });
});

test("clientLoader returns the invitationId when present", async () => {
  mocks.authenticate.mockResolvedValueOnce(undefined);
  const { clientLoader } = await import("~/app/routes/accept-invitation");

  await expect(
    clientLoader({
      request: new Request(
        "http://localhost/accept-invitation?invitationId=inv_1",
      ),
    } as never),
  ).resolves.toStrictEqual({ invitationId: "inv_1" });
  expect(mocks.authenticate).toHaveBeenCalled();
});

test("renders the AcceptInvitationCard with the invitationId from the loader", async () => {
  mocks.loaderData = { invitationId: "inv_1" };
  const { default: Component } = await import("~/app/routes/accept-invitation");

  render(<Component />);

  const card = screen.getByTestId("accept-invitation-card");
  expect(card).toHaveAttribute("data-invitation-id", "inv_1");
});
