import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import Layout from "~/app/layout";

test("renders the root document shell", () => {
  const markup = renderToStaticMarkup(
    <Layout>
      <span>Kitten</span>
    </Layout>,
  );

  expect(markup).toContain('<html lang="en">');
  expect(markup).toContain("<body>");
  expect(markup).toContain("<span>Kitten</span>");
});
