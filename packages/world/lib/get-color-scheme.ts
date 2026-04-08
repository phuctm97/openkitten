import { defaultColorScheme } from "~/lib/default-color-scheme";
import { isColorScheme } from "~/lib/is-color-scheme";

export function getColorScheme() {
  const inlineColorScheme = document.documentElement.style.colorScheme;

  if (isColorScheme(inlineColorScheme)) {
    return inlineColorScheme;
  }

  const [computedColorScheme = defaultColorScheme] = getComputedStyle(
    document.documentElement,
  )
    .colorScheme.trim()
    .split(/\s+/, 1);

  return isColorScheme(computedColorScheme)
    ? computedColorScheme
    : defaultColorScheme;
}
