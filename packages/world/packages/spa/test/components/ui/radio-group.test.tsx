import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";

test("renders radio group items with indicators", () => {
  const { container } = render(
    <RadioGroup aria-label="Theme" defaultValue="day">
      <div>
        <RadioGroupItem aria-label="Day" value="day" />
        Day
      </div>
      <div>
        <RadioGroupItem aria-label="Night" value="night" />
        Night
      </div>
    </RadioGroup>,
  );

  const day = screen.getByRole("radio", { name: "Day" });
  const night = screen.getByRole("radio", { name: "Night" });

  expect(container.querySelector('[data-slot="radio-group"]')).not.toBeNull();
  expect(day).toHaveAttribute("data-slot", "radio-group-item");
  expect(day).toHaveAttribute("data-state", "checked");
  expect(night).toHaveAttribute("data-state", "unchecked");
  expect(
    day.querySelector('[data-slot="radio-group-indicator"]'),
  ).not.toBeNull();
});
