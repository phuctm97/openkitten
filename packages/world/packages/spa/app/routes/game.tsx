import { useLayoutEffect, useState } from "react";
import { createGame } from "~/lib/create-game";

export default function Component() {
  const [element, ref] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!element) {
      return;
    }

    const game = createGame(element);

    return () => {
      game.destroy(true);
    };
  }, [element]);

  return (
    <div ref={ref} data-testid="game" className="h-full overflow-hidden" />
  );
}
