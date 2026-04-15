import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import NotFound from "~/app/not-found";

test("renders the not found state", () => {
  const markup = renderToStaticMarkup(<NotFound />);

  expect(markup).toContain("404");
  expect(markup).toContain("Not Found");
  expect(markup).toContain(
    "The page you are looking for does not exist or may have moved.",
  );
  expect(markup).toContain("Reload Page");
  expect(markup).toContain('href="/"');
  expect(markup).toContain(">Go Home</a>");
});
