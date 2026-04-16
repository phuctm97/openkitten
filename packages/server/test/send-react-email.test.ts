import { createElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const { sendRawEmail } = vi.hoisted(() => ({
  sendRawEmail: vi.fn(async () => undefined),
}));

vi.mock("~/lib/send-raw-email", () => ({ sendRawEmail }));

beforeEach(() => {
  sendRawEmail.mockClear();
});

it("renders a React email before sending it", async () => {
  const { sendReactEmail } = await import("~/lib/send-react-email");

  await sendReactEmail({
    subject: "Verify your email - OpenKitten",
    to: "user@example.com",
    element: createElement(
      "div",
      undefined,
      createElement("strong", undefined, "OpenKitten"),
      createElement("p", undefined, "Verify your email"),
    ),
  });

  expect(sendRawEmail).toHaveBeenCalledTimes(1);
  expect(sendRawEmail).toHaveBeenCalledWith({
    subject: "Verify your email - OpenKitten",
    to: "user@example.com",
    html: expect.stringContaining("<strong>OpenKitten</strong>"),
    text: expect.stringContaining("Verify your email"),
  });
});
