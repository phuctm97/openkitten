"use client";

import { useAuth } from "@better-auth-ui/react";

import { cn } from "~/lib/cn";
import { DeleteUser } from "./delete-user";

export type DangerZoneProps = {
  className?: string;
};

/**
 * Renders the danger zone heading and {@link DeleteUser}.
 * Gate with `deleteUser.enabled` at the call site (e.g. {@link SecuritySettings}).
 */
export function DangerZone({ className }: DangerZoneProps) {
  const { localization } = useAuth();

  return (
    <div className={cn(className)}>
      <h2 className="text-sm font-semibold mb-3">
        {localization.settings.dangerZone}
      </h2>

      <DeleteUser />
    </div>
  );
}
