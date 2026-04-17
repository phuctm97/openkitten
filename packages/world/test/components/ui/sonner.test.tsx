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

const { toasterSpy } = vi.hoisted(() => ({
  toasterSpy: vi.fn<(props: MockToasterProps) => void>(),
}));

vi.mock("~/hooks/use-theme", () => ({
  useTheme: () => ({
    colorScheme: "dark",
  }),
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
});

test("passes the world theme through to sonner", () => {
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
