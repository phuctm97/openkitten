import { useLayoutEffect } from "react";

import { useTheme } from "~/hooks/use-theme";

export function ThemeConnector() {
  const { colorScheme } = useTheme();

  useLayoutEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(colorScheme);
    document.documentElement.style.colorScheme = colorScheme;
  }, [colorScheme]);

  return null;
}
