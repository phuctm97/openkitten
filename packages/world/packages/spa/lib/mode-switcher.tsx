import { Gamepad2, Gauge, Home, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { Link, useLocation } from "react-router";
import { cn } from "~/lib/cn";

const modes = [
  {
    to: "/",
    icon: Home,
    label: "Home",
    matches: (path: string) => path === "/",
  },
  {
    to: "/app",
    icon: Gauge,
    label: "App mode",
    matches: (path: string) => path === "/app" || path.startsWith("/app/"),
  },
  {
    to: "/game",
    icon: Gamepad2,
    label: "Game mode",
    matches: (path: string) => path === "/game" || path.startsWith("/game/"),
  },
] satisfies ReadonlyArray<{
  to: string;
  icon: LucideIcon;
  label: string;
  matches: (path: string) => boolean;
}>;

const itemClassName =
  "relative inline-flex h-6 w-6 items-center justify-center rounded-full";

export function ModeSwitcher() {
  const { pathname } = useLocation();

  return (
    <>
      {modes.map(({ to, icon: Icon, label, matches }) => {
        const isActive = matches(pathname);
        return (
          <Link aria-label={label} className={itemClassName} key={to} to={to}>
            {isActive && (
              <motion.div
                className="absolute inset-0 rounded-full bg-secondary"
                layoutId="activeMode"
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
          </Link>
        );
      })}
    </>
  );
}
