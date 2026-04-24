import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Calendar, CalendarDayButton } from "~/components/ui/calendar";

test("renders a calendar with dropdown caption and week numbers", () => {
  render(
    <Calendar
      mode="single"
      month={new Date(2026, 3, 1)}
      captionLayout="dropdown"
      showWeekNumber
    />,
  );

  expect(document.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Apr" })).toBeInTheDocument();
});

test("renders default calendar label layout", () => {
  render(<Calendar mode="single" month={new Date(2026, 3, 1)} />);

  expect(screen.getByText("April 2026")).toBeInTheDocument();
});

test("focuses a focused calendar day button", () => {
  const focus = vi.fn();
  vi.spyOn(HTMLButtonElement.prototype, "focus").mockImplementation(focus);

  render(
    <CalendarDayButton
      day={
        {
          date: new Date(2026, 3, 24),
          displayMonth: new Date(2026, 3, 1),
        } as never
      }
      modifiers={{
        focused: true,
        selected: true,
        range_start: false,
        range_end: false,
        range_middle: false,
      }}
    >
      24
    </CalendarDayButton>,
  );

  expect(screen.getByRole("button", { name: "24" })).toHaveAttribute(
    "data-selected-single",
    "true",
  );
  expect(focus).toHaveBeenCalled();
});
