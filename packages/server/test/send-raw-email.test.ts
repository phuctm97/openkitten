import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

it("sends raw email with SMTP environment settings", async () => {
  const sendMail = vi.fn(async () => ({ accepted: ["user@example.com"] }));
  const createTransport = vi.fn(() => ({ sendMail }));

  vi.doMock("nodemailer", () => ({
    default: { createTransport },
  }));

  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_USER", "mailer@example.com");
  vi.stubEnv("SMTP_PASS", "super-secret");
  vi.stubEnv("SMTP_FROM", "Kitten Mail");

  const { sendRawEmail } = await import("../lib/send-raw-email");
  const result = await sendRawEmail({
    subject: "Verify your email - OpenKitten",
    text: "Hello from OpenKitten",
    html: "<p>Hello from OpenKitten</p>",
    to: "user@example.com",
  });

  expect(result).toStrictEqual({ accepted: ["user@example.com"] });
  expect(createTransport).toHaveBeenCalledWith({
    host: "smtp.example.com",
    auth: {
      user: "mailer@example.com",
      pass: "super-secret",
    },
  });
  expect(sendMail).toHaveBeenCalledWith({
    from: "Kitten Mail <mailer@example.com>",
    subject: "Verify your email - OpenKitten",
    text: "Hello from OpenKitten",
    html: "<p>Hello from OpenKitten</p>",
    to: "user@example.com",
  });
});

it("falls back to the default OpenKitten SMTP settings", async () => {
  const sendMail = vi.fn(async () => ({ messageId: "message-id" }));
  const createTransport = vi.fn(() => ({ sendMail }));

  vi.doMock("nodemailer", () => ({
    default: { createTransport },
  }));

  const { sendRawEmail } = await import("../lib/send-raw-email");
  const result = await sendRawEmail({
    subject: "Reset your password - OpenKitten",
    text: "Reset it",
    html: "<p>Reset it</p>",
    to: "reset@example.com",
  });

  expect(result).toStrictEqual({ messageId: "message-id" });
  expect(createTransport).toHaveBeenCalledWith({
    host: undefined,
    auth: {
      user: "team@openkitten.com",
      pass: undefined,
    },
  });
  expect(sendMail).toHaveBeenCalledWith({
    from: "OpenKitten <team@openkitten.com>",
    subject: "Reset your password - OpenKitten",
    text: "Reset it",
    html: "<p>Reset it</p>",
    to: "reset@example.com",
  });
});
