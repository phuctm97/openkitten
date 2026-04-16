import { expect, test } from "vitest";

import { baseLayoutProps } from "~/lib/base-layout-props";

test("defines shared Fumadocs navigation options for the website", () => {
  expect(baseLayoutProps.githubUrl).toBe(
    "https://github.com/phuctm97/openkitten",
  );
  expect(baseLayoutProps.nav?.title).toBe("OpenKitten");
  expect(baseLayoutProps.themeSwitch).toEqual({
    mode: "light-dark-system",
  });
});
