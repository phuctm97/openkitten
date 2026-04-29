import { SettingsIcon } from "lucide-react";
import { Link } from "react-router";
import { OrganizationSwitcher } from "~/components/auth/organization-switcher";
import { Button } from "~/components/ui/button";

export function HouseAnchor() {
  return (
    <div className="fixed top-4 left-4 z-30 flex max-w-[calc(100vw-13rem)] items-center gap-2 sm:max-w-none">
      <OrganizationSwitcher className="min-w-0 max-w-[9rem] bg-card/90 shadow-xs ring-1 ring-foreground/10 backdrop-blur sm:min-w-48 sm:max-w-none" />
      <Button
        asChild
        variant="outline"
        size="icon-sm"
        className="size-8 shrink-0 rounded-full bg-card/90 shadow-xs ring-1 ring-foreground/10 backdrop-blur"
      >
        <Link to="/workspace/settings" aria-label="Open house settings">
          <SettingsIcon className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
