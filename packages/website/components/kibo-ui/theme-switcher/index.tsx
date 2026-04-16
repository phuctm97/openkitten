"use client";

import type { LucideIcon } from "lucide-react";
import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useControllableState } from "radix-ui/internal";
import { useCallback, useEffect, useState } from "react";

import { Skeleton } from "~/components/ui/skeleton";
import type { Theme } from "~/lib/theme";
import { cn } from "~/lib/utils";

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
    icon: Monitor,
    label: "System theme",
  },
] satisfies ReadonlyArray<{
  key: Theme;
  icon: LucideIcon;
  label: string;
}>;

export type ThemeSwitcherProps = {
  value?: Theme;
  onChange?: (theme: Theme) => void;
  defaultValue?: Theme;
  className?: string;
};

const themeSwitcherClassName =
  "relative isolate flex h-8 rounded-full bg-background p-1 ring-1 ring-border";
const themeSwitcherItemClassName = "relative h-6 w-6 rounded-full";

export const ThemeSwitcher = ({
  value,
  onChange,
  defaultValue = "system",
  className,
}: ThemeSwitcherProps) => {
  const [theme, setTheme] = useControllableState({
    defaultProp: defaultValue,
    ...(value === undefined ? {} : { prop: value }),
    ...(onChange === undefined ? {} : { onChange }),
  });
  const [mounted, setMounted] = useState(false);

  const handleThemeClick = useCallback(
    (themeKey: Theme) => {
      setTheme(themeKey);
    },
    [setTheme],
  );

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div aria-hidden="true" className={cn(themeSwitcherClassName, className)}>
        {themes.map(({ key }) => (
          <Skeleton className={themeSwitcherItemClassName} key={key} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(themeSwitcherClassName, className)}>
      {themes.map(({ key, icon: Icon, label }) => {
        const isActive = theme === key;

        return (
          <button
            aria-label={label}
            className={themeSwitcherItemClassName}
            key={key}
            onClick={() => handleThemeClick(key)}
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
            />
          </button>
        );
      })}
    </div>
  );
};
