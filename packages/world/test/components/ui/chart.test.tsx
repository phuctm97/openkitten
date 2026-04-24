import { render, screen } from "@testing-library/react";
import { CircleIcon } from "lucide-react";
import { expect, test } from "vitest";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegendContent,
  ChartStyle,
  ChartTooltipContent,
} from "~/components/ui/chart";

const config = {
  cats: {
    label: "Cats",
    color: "#111111",
  },
  dogs: {
    label: "Dogs",
    theme: {
      light: "#222222",
      dark: "#eeeeee",
    },
  },
  birds: {
    label: "Birds",
    icon: CircleIcon,
  },
} satisfies ChartConfig;

test("renders chart styles for color and theme config", () => {
  render(<ChartStyle id="chart-test" config={config} />);

  expect(document.querySelector("style")?.textContent).toContain(
    "--color-cats",
  );
  expect(document.querySelector("style")?.textContent).toContain(".dark");
});

test("omits empty chart theme values", () => {
  render(
    <ChartStyle
      id="chart-empty-theme"
      config={{
        empty: { theme: { dark: "", light: "" } },
      }}
    />,
  );

  expect(document.querySelector("style")?.textContent).toContain(
    "[data-chart=chart-empty-theme]",
  );
});

test("throws when chart context is missing", () => {
  expect(() => render(<ChartTooltipContent active payload={[]} />)).toThrow(
    "useChart must be used within a <ChartContainer />",
  );
});

test("renders tooltip and legend content inside a chart", () => {
  render(
    <ChartContainer config={config}>
      <div>
        <ChartTooltipContent
          active
          indicator="dashed"
          label="cats"
          payload={
            [
              {
                dataKey: "cats",
                name: "cats",
                value: 1200,
                color: "#111111",
                payload: { fill: "#333333" },
              },
              {
                dataKey: "birds",
                name: "birds",
                value: "many",
                type: "square",
                color: "#444444",
              },
              { dataKey: "hidden", name: "hidden", type: "none" },
            ] as never
          }
        />
        <ChartLegendContent
          payload={
            [
              { dataKey: "cats", value: "Cats", color: "#111111" },
              { dataKey: "birds", value: "Birds", color: "#444444" },
              { dataKey: "hidden", value: "Hidden", type: "none" },
            ] as never
          }
          verticalAlign="top"
        />
        <ChartTooltipContent
          active
          indicator="line"
          labelKey="kind"
          nameKey="kind"
          payload={
            [
              {
                dataKey: "fallback",
                kind: "dogs",
                name: "fallback",
                value: 7,
                color: "#222222",
              },
            ] as never
          }
        />
        <ChartTooltipContent
          active
          hideIndicator
          labelFormatter={(value) => `Label ${value}`}
          payload={
            [
              {
                dataKey: "fallback",
                name: "fallback",
                value: 8,
                payload: { kind: "dogs" },
              },
            ] as never
          }
          labelKey="kind"
          nameKey="kind"
        />
        <ChartTooltipContent
          active
          formatter={(value) => <span>Formatted {value}</span>}
          hideLabel
          payload={
            [
              {
                dataKey: "cats",
                name: "cats",
                value: 9,
              },
            ] as never
          }
        />
        <ChartTooltipContent
          active
          label="unknown"
          payload={
            [
              {
                dataKey: "missing",
                name: "missing",
                value: null,
              },
            ] as never
          }
        />
        <ChartTooltipContent active payload={["primitive"] as never} />
        <ChartLegendContent
          hideIcon
          nameKey="kind"
          payload={
            [
              {
                dataKey: "fallback",
                kind: "dogs",
                value: "Dogs",
                color: "#222222",
              },
              "primitive",
            ] as never
          }
        />
        <ChartLegendContent
          payload={
            [
              {
                color: "#555555",
                value: "Fallback",
              },
            ] as never
          }
        />
      </div>
    </ChartContainer>,
  );

  expect(screen.getAllByText("Cats").length).toBeGreaterThan(0);
  expect(screen.getByText("1,200")).toBeInTheDocument();
  expect(screen.getByText("many")).toBeInTheDocument();
  expect(screen.getAllByText("Birds").length).toBeGreaterThan(0);
  expect(screen.getByText("Formatted 9")).toBeInTheDocument();
  expect(screen.getAllByText("Dogs").length).toBeGreaterThan(0);
});

test("returns nothing for inactive tooltip and empty style config", () => {
  const { container } = render(
    <ChartContainer config={{ empty: {} }}>
      <div>
        <ChartStyle id="empty" config={{ empty: {} }} />
        <ChartTooltipContent active={false} payload={[]} />
        <ChartLegendContent payload={[]} />
      </div>
    </ChartContainer>,
  );

  expect(container.querySelector("[data-slot='chart']")).toBeInTheDocument();
  expect(container.querySelector("style")).toBeNull();
});
