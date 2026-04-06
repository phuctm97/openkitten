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
    <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-2.5 shadow-[0_28px_100px_-48px_rgba(249,115,22,0.48)]">
      <div
        data-testid="scene"
        className="relative aspect-[16/10] min-h-[360px] w-full overflow-hidden rounded-[1.6rem] border border-[#22374a] bg-[#07111c] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_70px_-40px_rgba(0,0,0,0.9)] lg:min-h-[560px]"
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
      </div>
    </div>
  );
}
