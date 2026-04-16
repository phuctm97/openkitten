import { expect, test } from "vitest";

import { baseThemeProps } from "~/lib/base-theme-props";

test("defines the shared theme configuration for next-themes consumers", () => {
  expect(baseThemeProps).toEqual({
    storageKey: "openkitten-theme",
    attribute: "class",
    enableSystem: true,
    defaultTheme: "system",
    enableColorScheme: true,
    disableTransitionOnChange: true,
  });
});
