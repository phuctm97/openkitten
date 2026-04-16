import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { baseLayoutProps } from "~/lib/base-layout-props";
import { source } from "~/lib/source";

export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <DocsLayout tree={source.getPageTree("en")} {...baseLayoutProps}>
      {children}
    </DocsLayout>
  );
}
