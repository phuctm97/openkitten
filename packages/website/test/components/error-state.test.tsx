import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { ErrorState } from "~/components/error-state";
import { Button } from "~/components/ui/button";

test("renders the shared error state shell", () => {
  const markup = renderToStaticMarkup(
    <ErrorState
      badge="503"
      message="Service Unavailable"
      details="Try again in a moment."
      reload={<Button type="button">Reload Page</Button>}
    />,
  );

  expect(markup).toContain("Service Unavailable");
  expect(markup).toContain("Try again in a moment.");
  expect(markup).toContain("Reload Page");
  expect(markup).toContain('href="/"');
});
