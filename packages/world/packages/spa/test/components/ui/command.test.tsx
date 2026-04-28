import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/components/ui/command";
import { getSlot } from "~/lib/get-slot";

test("renders command palette slots", () => {
  render(
    <Command>
      <CommandInput placeholder="Search command" />
      <CommandList>
        <CommandEmpty>No results</CommandEmpty>
        <CommandGroup heading="General">
          <CommandItem>
            Open
            <CommandShortcut>Cmd+O</CommandShortcut>
          </CommandItem>
          <CommandSeparator />
        </CommandGroup>
      </CommandList>
    </Command>,
  );

  expect(getSlot("command")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Search command")).toHaveAttribute(
    "data-slot",
    "command-input",
  );
  expect(getSlot("command-shortcut")).toHaveTextContent("Cmd+O");
});

test("renders an open command dialog", () => {
  render(
    <CommandDialog open title="Actions" description="Run an action">
      <Command>Dialog command</Command>
    </CommandDialog>,
  );

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Actions")).toBeInTheDocument();
});

test("renders command dialog defaults", () => {
  render(
    <CommandDialog open>
      <Command>Default dialog command</Command>
    </CommandDialog>,
  );

  expect(screen.getByText("Command Palette")).toBeInTheDocument();
  expect(
    screen.getByText("Search for a command to run..."),
  ).toBeInTheDocument();
});
