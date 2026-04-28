import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

test("renders table slots", () => {
  render(
    <Table>
      <TableCaption>Roster</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Kitten</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
        </TableRow>
      </TableFooter>
    </Table>,
  );

  expect(screen.getByRole("table")).toHaveAttribute("data-slot", "table");
  expect(screen.getByText("Roster")).toHaveAttribute(
    "data-slot",
    "table-caption",
  );
  expect(screen.getByText("Kitten")).toHaveAttribute("data-slot", "table-cell");
});
