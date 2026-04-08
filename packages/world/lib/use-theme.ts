import { useColorScheme } from "@mantine/hooks";
import { useAtom } from "jotai";
import { defaultColorScheme } from "~/lib/default-color-scheme";
import { isColorScheme } from "~/lib/is-color-scheme";
import { themeAtom } from "~/lib/theme-atom";

export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);
  const colorScheme = useColorScheme(defaultColorScheme, {
    getInitialValueInEffect: false,
  });

  return {
    theme,
    setTheme,
    colorScheme: isColorScheme(theme) ? theme : colorScheme,
  };
}
