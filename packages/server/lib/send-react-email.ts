import { render, toPlainText } from "@react-email/components";
import type { ReactNode } from "react";
import { type SendRawEmailOptions, sendRawEmail } from "~/lib/send-raw-email";

export type SendReactEmailOptions = Omit<
  SendRawEmailOptions,
  "text" | "html"
> & {
  element: ReactNode;
};

export async function sendReactEmail({
  element,
  ...options
}: SendReactEmailOptions) {
  const html = await render(element);
  return sendRawEmail({ ...options, text: toPlainText(html), html });
}
