import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";

test("renders field layout primitives", () => {
  render(
    <FieldSet>
      <FieldLegend>Profile</FieldLegend>
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="display-name">Display name</FieldLabel>
          <FieldContent>
            <Input id="display-name" defaultValue="OpenKitten" />
            <FieldDescription>Shown across the house.</FieldDescription>
          </FieldContent>
        </Field>
        <FieldSeparator>Optional</FieldSeparator>
        <Field>
          <FieldTitle>Presence</FieldTitle>
          <FieldDescription>Share when you are home.</FieldDescription>
        </Field>
      </FieldGroup>
    </FieldSet>,
  );

  expect(screen.getByText("Profile")).toHaveAttribute("data-variant", "legend");
  expect(screen.getByText("Display name")).toHaveAttribute(
    "for",
    "display-name",
  );
  expect(screen.getByDisplayValue("OpenKitten")).toBeInTheDocument();
  expect(screen.getByText("Shown across the house.")).toHaveAttribute(
    "data-slot",
    "field-description",
  );
  expect(
    screen.getByText("Optional").closest('[data-slot="field-separator"]'),
  ).toHaveAttribute("data-content", "true");
  expect(screen.getByText("Presence")).toHaveAttribute(
    "data-slot",
    "field-label",
  );
});

test("renders label-style legends and empty separators", () => {
  const { container } = render(
    <>
      <FieldLegend variant="label">Privacy</FieldLegend>
      <FieldSeparator />
    </>,
  );

  expect(screen.getByText("Privacy")).toHaveAttribute("data-variant", "label");
  expect(
    container.querySelector('[data-slot="field-separator"]'),
  ).toHaveAttribute("data-content", "false");
  expect(
    container.querySelector('[data-slot="field-separator-content"]'),
  ).toBeNull();
});

test("prefers explicit field error children", () => {
  render(<FieldError>Custom issue</FieldError>);

  expect(screen.getByRole("alert")).toHaveTextContent("Custom issue");
});

test("renders nothing when there are no field errors", () => {
  const { container } = render(<FieldError />);

  expect(container).toBeEmptyDOMElement();
});

test("deduplicates a single field error message", () => {
  render(
    <FieldError
      errors={[{ message: "Required field" }, { message: "Required field" }]}
    />,
  );

  const alert = screen.getByRole("alert");

  expect(alert).toHaveTextContent("Required field");
  expect(alert.querySelector("ul")).toBeNull();
});

test("lists multiple unique field error messages", () => {
  render(
    <FieldError
      errors={[
        { message: "Required field" },
        undefined,
        { message: "Must be shorter" },
        { message: "Required field" },
      ]}
    />,
  );

  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("Required field")).toBeInTheDocument();
  expect(screen.getByText("Must be shorter")).toBeInTheDocument();
});
