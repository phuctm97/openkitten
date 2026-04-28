import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "~/components/ui/input-group";

test("focuses the input when an addon is clicked", () => {
  render(
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="House URL" />
    </InputGroup>,
  );

  const input = screen.getByPlaceholderText("House URL");

  fireEvent.click(screen.getByText("https://"));

  expect(input).toHaveFocus();
  expect(input.closest('[data-slot="input-group"]')).toHaveAttribute(
    "role",
    "group",
  );
  expect(
    screen.getByText("https://").closest('[data-slot="input-group-addon"]'),
  ).toHaveAttribute("data-align", "inline-start");
  expect(
    screen.getByText("https://").closest('[data-slot="input-group-addon"]'),
  ).toHaveAttribute("role", "group");
});

test("keeps button presses from stealing focus to the input", () => {
  render(
    <InputGroup>
      <InputGroupInput placeholder="Search houses" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton>Go</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>,
  );

  const input = screen.getByPlaceholderText("Search houses");
  const button = screen.getByRole("button", { name: "Go" });

  fireEvent.click(button);

  expect(input).not.toHaveFocus();
  expect(button).toHaveAttribute("type", "button");
  expect(button).toHaveAttribute("data-size", "xs");
  expect(button).toHaveAttribute("data-variant", "ghost");
  expect(button.closest('[data-slot="input-group-addon"]')).toHaveAttribute(
    "data-align",
    "inline-end",
  );
});

test("renders textarea controls inside input groups", () => {
  render(
    <InputGroup>
      <InputGroupTextarea placeholder="House notes" />
      <InputGroupAddon align="block-end">
        <InputGroupText>Markdown supported</InputGroupText>
      </InputGroupAddon>
    </InputGroup>,
  );

  expect(screen.getByPlaceholderText("House notes")).toHaveAttribute(
    "data-slot",
    "input-group-control",
  );
  expect(screen.getByText("Markdown supported")).toBeInTheDocument();
  expect(
    screen
      .getByText("Markdown supported")
      .closest('[data-slot="input-group-addon"]'),
  ).toHaveAttribute("data-align", "block-end");
});
