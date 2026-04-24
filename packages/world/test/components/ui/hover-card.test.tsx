import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import { getSlot } from "~/lib/get-slot";

test("renders an open hover card", () => {
  render(
    <HoverCard open>
      <HoverCardTrigger>Profile</HoverCardTrigger>
      <HoverCardContent align="start">Details</HoverCardContent>
    </HoverCard>,
  );

  expect(screen.getByText("Profile")).toHaveAttribute(
    "data-slot",
    "hover-card-trigger",
  );
  expect(getSlot("hover-card-content")).toHaveTextContent("Details");
});

test("renders hover card content defaults", () => {
  render(
    <HoverCard open>
      <HoverCardTrigger>Default profile</HoverCardTrigger>
      <HoverCardContent>Default details</HoverCardContent>
    </HoverCard>,
  );

  expect(getSlot("hover-card-content")).toHaveTextContent("Default details");
});
