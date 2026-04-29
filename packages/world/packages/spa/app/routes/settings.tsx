import { Outlet, replace, useLocation, useNavigate } from "react-router";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { authenticate } from "~/lib/authenticate";
import { PageBreadcrumb } from "~/lib/page-breadcrumb";
import type { Route } from "./+types/settings";

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  await authenticate(request.url);
  const url = new URL(request.url);
  if (url.pathname === "/settings" || url.pathname === "/settings/") {
    throw replace("/settings/account");
  }
  return null;
}

const tabs = {
  account: {
    value: "account",
    label: "Setting",
    title: "Account",
    to: "/settings/account",
    description: "Manage your profile, email, and avatar.",
  },
  security: {
    value: "security",
    label: "Security",
    title: "Security",
    to: "/settings/security",
    description: "Update your password and connected sign-in methods.",
  },
} as const;

const tabList = [tabs.account, tabs.security] as const;

export default function Component() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.endsWith("/security")
    ? "security"
    : "account";
  const current = tabs[activeTab];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-20 pb-10 sm:px-6 lg:pt-24">
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <PageBreadcrumb
            items={[{ label: "Home", to: "/" }, { label: current.title }]}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-heading text-3xl text-foreground">
                {current.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {current.description}
              </p>
            </div>
          </div>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (value === "account" || value === "security") {
            void navigate(tabs[value].to);
          }
        }}
        className="mb-6"
      >
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-none sm:flex">
          {tabList.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="sm:px-4">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Outlet />
    </main>
  );
}
