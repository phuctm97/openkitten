import nodemailer from "nodemailer";

const user = Bun.env.SMTP_USER || "team@openkitten.com";

const transporter = nodemailer.createTransport({
  host: Bun.env.SMTP_HOST,
  auth: { user, pass: Bun.env.SMTP_PASS },
});

const from = `${Bun.env.SMTP_FROM || "OpenKitten"} <${user}>`;

export type SendRawEmailOptions = Pick<
  nodemailer.SendMailOptions,
  "subject" | "text" | "html" | "to"
>;

export function sendRawEmail(options: SendRawEmailOptions) {
  return transporter.sendMail({ ...options, from });
}
