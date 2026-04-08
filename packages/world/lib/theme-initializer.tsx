import { shallowEqual } from "@mantine/hooks";
import { memo } from "react";
import { defaultColorScheme } from "~/lib/default-color-scheme";

export const ThemeInitializer = memo(
  () => (
    <script>
      {`
(function() {
  let colorScheme = ${JSON.stringify(defaultColorScheme)};
  const theme = localStorage.getItem('openkitten-theme');
  if (theme === 'light' || theme === 'dark')
    colorScheme = theme;
  else if (matchMedia('(prefers-color-scheme: dark)').matches)
    colorScheme = 'dark';
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(colorScheme);
  document.documentElement.style.colorScheme = colorScheme;
})();
`.trim()}
    </script>
  ),
  shallowEqual,
);
