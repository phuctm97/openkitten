const worldAssetBasePath = "/world/v1";

export const worldAssets = {
  backgrounds: {
    roomShell: {
      key: "world-v1-background-room-shell",
      path: `${worldAssetBasePath}/backgrounds/house-room-shell-v1.png`,
    },
  },
  cats: {
    catAAwake: {
      key: "world-v1-cat-a-awake",
      path: `${worldAssetBasePath}/cats/cat-a-awake-v4.png`,
    },
    catBResting: {
      key: "world-v1-cat-b-resting",
      path: `${worldAssetBasePath}/cats/cat-b-resting-v4.png`,
    },
  },
  fx: {
    catShadow: {
      key: "world-v1-cat-shadow",
      path: `${worldAssetBasePath}/fx/cat-shadow-v2.png`,
    },
  },
  preloadEntries: [
    {
      key: "world-v1-background-room-shell",
      path: `${worldAssetBasePath}/backgrounds/house-room-shell-v1.png`,
    },
    {
      key: "world-v1-cat-a-awake",
      path: `${worldAssetBasePath}/cats/cat-a-awake-v4.png`,
    },
    {
      key: "world-v1-cat-b-resting",
      path: `${worldAssetBasePath}/cats/cat-b-resting-v4.png`,
    },
    {
      key: "world-v1-cat-shadow",
      path: `${worldAssetBasePath}/fx/cat-shadow-v2.png`,
    },
  ],
} as const;
