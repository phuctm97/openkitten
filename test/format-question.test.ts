import { Effect } from "effect";
import { assert, expect, test, vi } from "vitest";
import { formatQuestionMessage } from "~/lib/format-question-message";
import { formatQuestionPending } from "~/lib/format-question-pending";
import { formatQuestionPrompt } from "~/lib/format-question-prompt";
import { formatQuestionRejected } from "~/lib/format-question-rejected";
import { formatQuestionReplied } from "~/lib/format-question-replied";

vi.mock("telegram-markdown-v2", { spy: true });

test("formatQuestionMessage renders header, question, and options", () => {
  const chunks = Effect.runSync(
    formatQuestionMessage({
      question: "What would you like to do?",
      header: "Action",
      options: [
        { label: "Yes", description: "Approve the change" },
        { label: "No", description: "Reject the change" },
      ],
    }),
  );
  expect(chunks.length).toBeGreaterThan(0);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("❔");
  expect(text).toContain("Action");
  expect(text).toContain("What would you like to do?");
  expect(text).toContain("Yes");
  expect(text).toContain("Approve the change");
  expect(text).toContain("No");
  expect(text).toContain("Reject the change");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
});

test("formatQuestionMessage renders without options", () => {
  const chunks = Effect.runSync(
    formatQuestionMessage({
      question: "What is your name?",
      header: "Name",
      options: [],
      custom: true,
    }),
  );
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("Name");
  expect(text).toContain("What is your name?");
});

test("formatQuestionPrompt returns correct text for single-select", () => {
  expect(
    formatQuestionPrompt({
      question: "q",
      header: "h",
      options: [{ label: "A", description: "a" }],
    }),
  ).toBe(
    "_Choose one of the following options, or reply with your own answer_",
  );
});

test("formatQuestionPrompt returns correct text for single-select custom:false", () => {
  expect(
    formatQuestionPrompt({
      question: "q",
      header: "h",
      options: [{ label: "A", description: "a" }],
      custom: false,
    }),
  ).toBe("_Choose one of the following options_");
});

test("formatQuestionPrompt returns correct text for multi-select", () => {
  expect(
    formatQuestionPrompt({
      question: "q",
      header: "h",
      options: [{ label: "A", description: "a" }],
      multiple: true,
    }),
  ).toBe(
    "_Select all that apply and press *Confirm*, or reply with your own answer_",
  );
});

test("formatQuestionPrompt returns correct text for multi-select custom:false", () => {
  expect(
    formatQuestionPrompt({
      question: "q",
      header: "h",
      options: [{ label: "A", description: "a" }],
      multiple: true,
      custom: false,
    }),
  ).toBe("_Select all that apply and press *Confirm*_");
});

test("formatQuestionReplied includes answers", () => {
  expect(formatQuestionReplied(["Yes", "Maybe"])).toBe("✓ Yes, Maybe");
});

test("formatQuestionRejected includes dismissal text", () => {
  expect(formatQuestionRejected()).toBe("✕ Dismissed");
});

test("formatQuestionPending includes tip", () => {
  const chunks = Effect.runSync(formatQuestionPending());
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("❓");
  expect(text).toContain("Answer the pending question");
  const chunk = chunks.at(0);
  assert.isDefined(chunk);
  assert.isDefined(chunk.markdown);
  expect(chunk.markdown).toContain("```tip\n");
});
