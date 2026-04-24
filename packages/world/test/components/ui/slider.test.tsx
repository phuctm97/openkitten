import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { Slider } from "~/components/ui/slider";

test("renders slider thumbs from value, default value, and bounds", () => {
  const { rerender } = render(<Slider value={[25, 75]} />);

  expect(document.querySelectorAll('[data-slot="slider-thumb"]')).toHaveLength(
    2,
  );

  rerender(<Slider defaultValue={[50]} />);

  expect(document.querySelectorAll('[data-slot="slider-thumb"]')).toHaveLength(
    1,
  );

  rerender(<Slider min={10} max={20} />);

  expect(document.querySelectorAll('[data-slot="slider-thumb"]')).toHaveLength(
    2,
  );
});
