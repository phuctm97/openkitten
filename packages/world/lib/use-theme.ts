import { useColorScheme } from "@mantine/hooks";
import { useAtom } from "jotai";
import { isColorScheme } from "~/lib/is-color-scheme";
import { themeAtom } from "~/lib/theme-atom";

export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);
  const colorScheme = useColorScheme("light", {
    getInitialValueInEffect: false,
  });

  return {
    theme,
    setTheme,
    colorScheme: isColorScheme(theme) ? theme : colorScheme,
  };
}
