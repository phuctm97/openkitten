import { Application, extend } from "@pixi/react";
import { Container, Graphics } from "pixi.js";
import { drawScene } from "~/lib/draw-scene";

extend({ Container, Graphics });

const size = {
  height: 800,
  width: 1280,
};

function draw(graphics: Graphics) {
  drawScene(graphics, size.width, size.height, performance.now() / 1000);
}

export function Scene() {
  return (
    <div className="rounded-[2rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-3 shadow-[0_28px_100px_-48px_rgba(249,115,22,0.55)] backdrop-blur-sm">
      <div className="rounded-[1.65rem] border border-white/10 bg-[linear-gradient(180deg,#0c1621,#08111a)] p-3">
        <div
          data-testid="scene"
          className="relative aspect-[16/10] min-h-[360px] w-full overflow-hidden rounded-[1.35rem] border border-[#20354a] bg-[#07111c] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_70px_-40px_rgba(0,0,0,0.9)] lg:min-h-[560px]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(88,196,255,0.16),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(249,115,22,0.08),_transparent_34%),linear-gradient(180deg,_rgba(15,22,36,0.18),_rgba(3,6,11,0.82))]" />
          <Application
            antialias
            autoDensity
            backgroundAlpha={0}
            className="absolute inset-0 size-full"
            height={size.height}
            width={size.width}
          >
            <pixiContainer>
              <pixiGraphics draw={draw} />
            </pixiContainer>
          </Application>
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-3 rounded-full border border-white/10 bg-black/18 px-3 py-1.5 backdrop-blur-sm">
            <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
            <span className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.28em] text-white/72">
              World Screen
            </span>
          </div>
          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-col gap-3 rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(7,15,24,0.3),rgba(7,15,24,0.5))] px-4 py-3 text-white/82 backdrop-blur-md sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="m-0 font-mono text-[0.68rem] uppercase tracking-[0.26em] text-white/55">
                Phase 1
              </p>
              <p className="m-0 text-sm font-medium sm:text-base">
                A tiny house slice lives inside the app shell now.
              </p>
            </div>
            <p className="m-0 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-white/60">
              two cats / one room
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
