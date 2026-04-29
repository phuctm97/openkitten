import { useMounted } from "@mantine/hooks";
import { Airplay, type LucideIcon, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { Skeleton } from "~/components/ui/skeleton";
import { useTheme } from "~/hooks/use-theme";
import { cn } from "~/lib/cn";
import type { Theme } from "~/lib/theme";

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

const itemClassName =
  "relative inline-flex h-6 w-6 items-center justify-center rounded-full";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <>
        {themes.map(({ key }) => (
          <Skeleton className={itemClassName} key={key} />
        ))}
      </>
    );
  }

  return (
    <>
      {themes.map(({ key, icon: Icon, label }) => {
        const isActive = theme === key;

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
                "relative z-10 h-4 w-4",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
              fill="currentColor"
            />
          </button>
        );
      })}
    </>
  );
}
