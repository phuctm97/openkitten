import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { QueryErrorAlert } from "~/lib/query-error-alert";

test("renders the default title and the formatted error message", () => {
  render(
    <QueryErrorAlert
      error={new Error("workspace lookup failed")}
      isRefetching={false}
      onRetry={() => {}}
    />,
  );

  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  expect(screen.getByText("workspace lookup failed")).toBeInTheDocument();
});

test("uses a custom title when provided", () => {
  render(
    <QueryErrorAlert
      error={new Error("nope")}
      isRefetching={false}
      onRetry={() => {}}
      title="Couldn't load the workspace"
    />,
  );

  expect(screen.getByText("Couldn't load the workspace")).toBeInTheDocument();
});

test("invokes onRetry when the retry button is clicked", () => {
  const onRetry = vi.fn();
  render(
    <QueryErrorAlert
      error={new Error("transient")}
      isRefetching={false}
      onRetry={onRetry}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test("disables the retry button and shows a spinner while refetching", () => {
  render(
    <QueryErrorAlert
      error={new Error("retrying")}
      isRefetching
      onRetry={() => {}}
    />,
  );

  const retry = screen.getByRole("button", { name: /retry/i });
  expect(retry).toBeDisabled();
  expect(screen.getByRole("status")).toBeInTheDocument();
});

test("renders the message field of a plain object that carries one", () => {
  render(
    <QueryErrorAlert
      error={{ message: "object without Error prototype" }}
      isRefetching={false}
      onRetry={() => {}}
    />,
  );

  expect(
    screen.getByText("object without Error prototype"),
  ).toBeInTheDocument();
});

test("falls back to the generic message when the error has no usable text", () => {
  render(
    <QueryErrorAlert
      error={42}
      isRefetching={false}
      onRetry={() => {}}
      title="Couldn't load"
    />,
  );

  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  expect(screen.getByText("Couldn't load")).toBeInTheDocument();
});

test("forwards extra classes to the alert root", () => {
  const { container } = render(
    <QueryErrorAlert
      error={new Error("x")}
      isRefetching={false}
      onRetry={() => {}}
      className="extra-class"
    />,
  );

  expect(container.querySelector('[role="alert"]')).toHaveClass("extra-class");
});
