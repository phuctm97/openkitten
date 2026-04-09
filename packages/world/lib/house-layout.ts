import { worldAssets } from "~/lib/world-assets";

export const houseLayout = {
  cats: [
    {
      depth: 620,
      id: "cat-a",
      scale: 0.22,
      shadowAlpha: 0.34,
      shadowScale: 0.28,
      shadowX: 872,
      shadowY: 707,
      textureKey: worldAssets.cats.catAAwake.key,
      x: 872,
      y: 622,
    },
    {
      depth: 660,
      id: "cat-b",
      scale: 0.2,
      shadowAlpha: 0.28,
      shadowScale: 0.22,
      shadowX: 664,
      shadowY: 758,
      textureKey: worldAssets.cats.catBResting.key,
      x: 664,
      y: 718,
    },
  ],
  sceneSize: {
    height: 1024,
    width: 1536,
  },
} as const;
