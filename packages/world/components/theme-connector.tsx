import { useEffect } from "react";

import { useTheme } from "~/hooks/use-theme";

function disableTransitions() {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}",
    ),
  );
  document.head.appendChild(style);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    clearTimeout(timeout);
    style.remove();
  };

  return () => {
    window.getComputedStyle(document.body);
    timeout = setTimeout(cleanup, 1);
    return cleanup;
  };
}

export function ThemeConnector() {
  const { colorScheme } = useTheme();

  useEffect(() => {
    const restoreTransitions = disableTransitions();
    let cleanup = () => {};

    try {
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(colorScheme);
      document.documentElement.style.colorScheme = colorScheme;
    } finally {
      cleanup = restoreTransitions();
    }

    return cleanup;
  }, [colorScheme]);

  return null;
}
