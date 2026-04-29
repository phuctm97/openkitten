import { useLayoutEffect, useState } from "react";
import { cn } from "~/lib/cn";
import { createAmbientGame } from "~/lib/create-ambient-game";

export function AmbientHouseCanvas({ className }: { className?: string }) {
  const [element, ref] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!element) return;
    const game = createAmbientGame(element);
    return () => {
      game.destroy(true);
    };
  }, [element]);

  return (
    <div
      ref={ref}
      data-testid="ambient-house-canvas"
      className={cn("h-full w-full overflow-hidden", className)}
    />
  );
}
