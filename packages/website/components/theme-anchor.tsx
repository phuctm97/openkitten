"use client";

import { useMounted } from "@mantine/hooks";
import type { LucideIcon } from "lucide-react";
import { Airplay, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";

import { isTheme } from "~/lib/is-theme";
import type { Theme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import { Skeleton } from "./ui/skeleton";

const themes = [
  {
    key: "light",
    icon: Sun,
    label: "Light theme",
  },
  {
    key: "dark",
    icon: Moon,
    label: "Dark theme",
  },
  {
    key: "system",
    icon: Airplay,
    label: "System theme",
  },
] satisfies ReadonlyArray<{
  key: Theme;
  icon: LucideIcon;
  label: string;
}>;

const containerClassName =
  "isolate flex h-8 rounded-full bg-background p-1 ring-1 ring-border fixed right-4 top-4 z-10";
const itemClassName = "relative h-6 w-6 rounded-full";

export function ThemeAnchor() {
  const { setTheme, theme } = useTheme();
  const activeTheme: Theme = isTheme(theme) ? theme : "system";
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div aria-hidden="true" className={containerClassName}>
        {themes.map(({ key }) => (
          <Skeleton className={itemClassName} key={key} />
        ))}
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {themes.map(({ key, icon: Icon, label }) => {
        const isActive = activeTheme === key;

        return (
          <button
            aria-label={label}
            className={itemClassName}
            key={key}
            onClick={() => setTheme(key)}
            type="button"
          >
            {isActive && (
              <motion.div
                className="absolute inset-0 rounded-full bg-secondary"
                layoutId="activeTheme"
                transition={{ type: "spring", duration: 0.5 }}
              />
            )}
            <Icon
              className={cn(
                "relative z-10 m-auto h-4 w-4",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
              fill="currentColor"
            />
          </button>
        );
      })}
    </div>
  );
}
