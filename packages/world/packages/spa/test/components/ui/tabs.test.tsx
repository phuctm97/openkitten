import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  tabsListVariants,
} from "~/components/ui/tabs";

test("renders tabs with the default orientation and list variant", () => {
  const { container } = render(
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview Panel</TabsContent>
      <TabsContent value="inventory">Inventory Panel</TabsContent>
    </Tabs>,
  );

  expect(container.querySelector('[data-slot="tabs"]')).toHaveAttribute(
    "data-orientation",
    "horizontal",
  );
  expect(container.querySelector('[data-slot="tabs-list"]')).toHaveAttribute(
    "data-variant",
    "default",
  );
  expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
    "data-slot",
    "tabs-trigger",
  );
  expect(screen.getByText("Overview Panel")).toHaveAttribute(
    "data-slot",
    "tabs-content",
  );
  expect(tabsListVariants()).toContain("bg-muted");
});

test("renders vertical tabs with the line variant", () => {
  const { container } = render(
    <Tabs defaultValue="activity" orientation="vertical">
      <TabsList variant="line">
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="activity">Activity Panel</TabsContent>
    </Tabs>,
  );

  expect(container.querySelector('[data-slot="tabs"]')).toHaveAttribute(
    "data-orientation",
    "vertical",
  );
  expect(container.querySelector('[data-slot="tabs-list"]')).toHaveAttribute(
    "data-variant",
    "line",
  );
  expect(tabsListVariants({ variant: "line" })).toContain("bg-transparent");
});
