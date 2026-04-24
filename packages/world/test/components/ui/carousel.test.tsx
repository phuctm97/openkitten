import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
} from "~/components/ui/carousel";

const scrollPrev = vi.fn();
const scrollNext = vi.fn();
const on = vi.fn();
const off = vi.fn();
let api:
  | {
      canScrollPrev: () => boolean;
      canScrollNext: () => boolean;
      scrollPrev: () => void;
      scrollNext: () => void;
      on: typeof on;
      off: typeof off;
    }
  | undefined;

vi.mock("embla-carousel-react", () => ({
  default: () => [vi.fn(), api],
}));

function MissingCarouselContext() {
  useCarousel();

  return null;
}

beforeEach(() => {
  scrollPrev.mockClear();
  scrollNext.mockClear();
  on.mockClear();
  off.mockClear();
  api = {
    canScrollPrev: () => true,
    canScrollNext: () => true,
    scrollPrev,
    scrollNext,
    on: vi.fn((_event, callback) => {
      callback(undefined as never);
      on(_event, callback);
    }),
    off,
  };
});

test("throws when carousel context is missing", () => {
  expect(() => render(<MissingCarouselContext />)).toThrow(
    "useCarousel must be used within a <Carousel />",
  );
});

test("renders vertical carousel and keyboard controls", () => {
  const setApi = vi.fn();

  render(
    <Carousel orientation="vertical" setApi={setApi}>
      <CarouselContent>
        <CarouselItem>Slide</CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>,
  );

  const carousel = screen.getByRole("region");

  fireEvent.keyDown(carousel, { key: "ArrowLeft" });
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
  fireEvent.click(screen.getByRole("button", { name: "Next slide" }));

  expect(setApi).toHaveBeenCalled();
  expect(scrollPrev).toHaveBeenCalledTimes(2);
  expect(scrollNext).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Slide")).toHaveAttribute(
    "data-slot",
    "carousel-item",
  );
});

test("renders horizontal carousel defaults", () => {
  render(
    <Carousel>
      <CarouselContent>
        <CarouselItem>Horizontal slide</CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>,
  );

  const carousel = screen.getByRole("region");

  fireEvent.keyDown(carousel, { key: "Escape" });

  expect(screen.getByText("Horizontal slide")).toHaveClass("pl-4");
  expect(screen.getByRole("button", { name: "Previous slide" })).toHaveClass(
    "-left-12",
  );
});

test("renders without carousel api", () => {
  api = undefined;

  render(
    <Carousel setApi={vi.fn()}>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
  fireEvent.click(screen.getByRole("button", { name: "Next slide" }));

  expect(scrollPrev).not.toHaveBeenCalled();
  expect(scrollNext).not.toHaveBeenCalled();
});

test("uses axis option when orientation is absent", () => {
  const { rerender } = render(
    <Carousel orientation={"" as never} opts={{ axis: "y" }}>
      <CarouselContent>
        <CarouselItem>Axis slide</CarouselItem>
      </CarouselContent>
    </Carousel>,
  );

  expect(screen.getByText("Axis slide")).toHaveClass("pt-4");

  rerender(
    <Carousel orientation={"" as never} opts={{ axis: "x" }}>
      <CarouselContent>
        <CarouselItem>Horizontal axis slide</CarouselItem>
      </CarouselContent>
    </Carousel>,
  );

  expect(screen.getByText("Horizontal axis slide")).toHaveClass("pl-4");
});
