import { ThemeSwitcher } from "~/components/kibo-ui/theme-switcher";
import { useTheme } from "~/lib/use-theme";

export function FloatingThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <ThemeSwitcher
      value={theme}
      onChange={setTheme}
      className="fixed right-4 top-4 z-10"
    />
  );
}
