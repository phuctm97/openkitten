import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { Separator } from "~/components/ui/separator";

test("renders a decorative horizontal separator by default", () => {
  const { container } = render(<Separator />);
  const separator = container.firstElementChild;

  expect(separator).not.toBeNull();
  expect(separator).toHaveAttribute("data-slot", "separator");
  expect(separator).toHaveAttribute("data-orientation", "horizontal");
});

test("renders a semantic vertical separator when requested", () => {
  render(<Separator decorative={false} orientation="vertical" />);

  const separator = document.querySelector('[data-slot="separator"]');

  expect(separator).toHaveAttribute("data-orientation", "vertical");
  expect(separator).toHaveAttribute("role", "separator");
  expect(separator).toHaveAttribute("aria-orientation", "vertical");
});
