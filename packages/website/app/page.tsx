import { HomeLayout } from "fumadocs-ui/layouts/home";
import Link from "next/link";

import { baseLayoutProps } from "~/lib/base-layout-props";

export default function Page() {
  return (
    <HomeLayout
      {...baseLayoutProps}
      links={[
        {
          text: "Docs",
          url: "/docs",
        },
      ]}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-6 py-16">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            OpenKitten
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            The landing page is coming soon. Start with the{" "}
            <Link
              className="text-foreground underline underline-offset-4"
              href="/docs"
            >
              docs
            </Link>
            .
          </p>
        </div>
      </div>
    </HomeLayout>
  );
}
