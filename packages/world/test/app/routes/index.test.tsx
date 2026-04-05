import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";

import Component from "~/app/routes/index";
import { stubMatchMedia } from "~/test/stub-match-media";

function getThemeValue(label: string, value: string) {
  return screen.getByText((_content, node) => {
    return node?.textContent === `${label} = "${value}"`;
  });
}

test("renders the house placeholder and both font previews", () => {
  render(<Component />);
  const monoCard = screen.getByText("Mono").closest("article");

  expect(screen.getByText("House Route Placeholder")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Oxanium gives OpenKitten World its playful, futuristic house voice.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Sans")).toBeInTheDocument();
  expect(screen.getByText("Mono")).toBeInTheDocument();
  expect(getThemeValue("theme", "auto")).toBeInTheDocument();
  expect(getThemeValue("colorScheme", "light")).toBeInTheDocument();
  expect(monoCard).toHaveTextContent(
    'session.claimedThreads[0] = "pricing-review"',
  );
  expect(monoCard).toHaveTextContent(
    'cat.memory.append("Keep pricing practical and human-readable.")',
  );
});

test("switches between auto, light, and dark themes", async () => {
  const user = userEvent.setup();
  const matchMedia = stubMatchMedia("light");

  render(<Component />);

  act(() => {
    matchMedia.setColorScheme("dark");
  });

  expect(getThemeValue("colorScheme", "dark")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Light" }));

  expect(getThemeValue("theme", "light")).toBeInTheDocument();
  expect(getThemeValue("colorScheme", "light")).toBeInTheDocument();
  expect(localStorage.getItem("openkitten-world-theme")).toBe("light");

  await user.click(screen.getByRole("button", { name: "Dark" }));

  expect(getThemeValue("theme", "dark")).toBeInTheDocument();
  expect(getThemeValue("colorScheme", "dark")).toBeInTheDocument();
  expect(localStorage.getItem("openkitten-world-theme")).toBe("dark");

  act(() => {
    matchMedia.setColorScheme("light");
  });

  expect(getThemeValue("colorScheme", "dark")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Auto" }));

  expect(getThemeValue("theme", "auto")).toBeInTheDocument();
  expect(getThemeValue("colorScheme", "light")).toBeInTheDocument();
  expect(localStorage.getItem("openkitten-world-theme")).toBe("auto");
});
