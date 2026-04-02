import { expect, test } from "vitest";
import { grammyFormatQuestionMessage } from "~/lib/grammy-format-question-message";

const question = {
  header: "Choose model",
  question: "Which model do you want to use?",
  options: [
    { label: "Fast", description: "Low latency" },
    { label: "Smart", description: "High quality" },
  ],
};

test("includes header and question text", () => {
  const chunks = grammyFormatQuestionMessage(question);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("Choose model");
  expect(text).toContain("Which model do you want to use?");
});

test("includes option labels and descriptions", () => {
  const chunks = grammyFormatQuestionMessage(question);
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("Fast");
  expect(text).toContain("Low latency");
  expect(text).toContain("Smart");
  expect(text).toContain("High quality");
});

test("returns non-empty chunks", () => {
  const chunks = grammyFormatQuestionMessage(question);
  expect(chunks).not.toHaveLength(0);
});

test("handles empty options", () => {
  const chunks = grammyFormatQuestionMessage({
    header: "Input",
    question: "Enter a value",
    options: [],
  });
  const text = chunks.map((c) => c.text).join("\n");
  expect(text).toContain("Enter a value");
  expect(text).not.toContain("- **");
});
