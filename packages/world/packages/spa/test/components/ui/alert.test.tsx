import { render, screen } from "@testing-library/react";
import { CircleAlertIcon } from "lucide-react";
import { expect, test } from "vitest";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { getSlot } from "~/lib/get-slot";

test("renders alert content and variants", () => {
  render(
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>Problem</AlertTitle>
      <AlertDescription>Something failed</AlertDescription>
      <AlertAction>Retry</AlertAction>
    </Alert>,
  );

  expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
  expect(getSlot("alert-title")).toHaveTextContent("Problem");
  expect(getSlot("alert-description")).toHaveTextContent("Something failed");
  expect(getSlot("alert-action")).toHaveTextContent("Retry");
});
