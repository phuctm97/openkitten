import { expect, test } from "vitest";
import { grammyFormatQuestionPrompt } from "~/lib/grammy-format-question-prompt";

test("single-select without custom", () => {
  const result = grammyFormatQuestionPrompt({
    header: "h",
    question: "q",
    options: [],
    custom: false,
  });
  expect(result).toContain("Choose one");
  expect(result).not.toContain("reply with your own answer");
});

test("single-select with custom (default)", () => {
  const result = grammyFormatQuestionPrompt({
    header: "h",
    question: "q",
    options: [],
  });
  expect(result).toContain("Choose one");
  expect(result).toContain("reply with your own answer");
});

test("multi-select without custom", () => {
  const result = grammyFormatQuestionPrompt({
    header: "h",
    question: "q",
    options: [],
    multiple: true,
    custom: false,
  });
  expect(result).toContain("Select all that apply");
  expect(result).toContain("Confirm");
  expect(result).not.toContain("reply with your own answer");
});

test("multi-select with custom", () => {
  const result = grammyFormatQuestionPrompt({
    header: "h",
    question: "q",
    options: [],
    multiple: true,
    custom: true,
  });
  expect(result).toContain("Select all that apply");
  expect(result).toContain("reply with your own answer");
});

test("wraps text in italic markers", () => {
  const result = grammyFormatQuestionPrompt({
    header: "h",
    question: "q",
    options: [],
  });
  expect(result).toMatch(/^_.*_$/);
});
