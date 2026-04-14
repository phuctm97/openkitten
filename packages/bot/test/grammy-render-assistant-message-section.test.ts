import { expect, test } from "vitest";
import { grammyRenderAssistantMessageSection } from "~/lib/grammy-render-assistant-message-section";

test("renders text sections", () => {
  expect(
    grammyRenderAssistantMessageSection({
      type: "text",
      text: "  Hello from OpenKitten  ",
    }),
  ).toBe("Hello from OpenKitten");
});
