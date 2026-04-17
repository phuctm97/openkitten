import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, expect, test, vi } from "vitest";

type MockToasterProps = {
  className?: string;
  icons?: Record<string, React.ReactElement<{ className?: string }>>;
  position?: string;
  style?: Record<string, string>;
  theme?: string;
  toastOptions?: {
    classNames?: {
      toast?: string;
    };
  };
};

const { toasterSpy, useThemeSpy } = vi.hoisted(() => ({
  toasterSpy: vi.fn<(props: MockToasterProps) => void>(),
  useThemeSpy: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => useThemeSpy(),
}));

vi.mock("sonner", () => ({
  Toaster: (props: MockToasterProps) => {
    toasterSpy(props);

    return <div data-testid="sonner-root" />;
  },
}));

import { Toaster } from "~/components/ui/sonner";

beforeEach(() => {
  toasterSpy.mockClear();
  useThemeSpy.mockReset();
  useThemeSpy.mockReturnValue({
    theme: "dark",
  });
});

test("passes the website theme through to sonner", () => {
  render(<Toaster position="top-right" />);

  expect(screen.getByTestId("sonner-root")).toBeInTheDocument();

  const props = toasterSpy.mock.calls[0]?.[0];

  expect(props).toBeDefined();
  expect(props?.theme).toBe("dark");
  expect(props?.position).toBe("top-right");
  expect(props?.className).toBe("toaster group");
  expect(props?.toastOptions).toEqual({
    classNames: {
      toast: "cn-toast",
    },
  });
  expect(props?.style).toMatchObject({
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--border)",
    "--border-radius": "var(--radius)",
  });
  expect(props?.icons?.["loading"]?.props.className).toContain("animate-spin");
});

test("falls back to the system theme when next-themes has no value", () => {
  useThemeSpy.mockReturnValue({});

  render(<Toaster />);

  expect(toasterSpy.mock.calls[0]?.[0]?.theme).toBe("system");
});
