const worldAssetBasePath = "/world/v1";

export const worldAssets = {
  backgrounds: {
    foregroundTrim: {
      key: "world-v1-background-foreground-trim",
      path: `${worldAssetBasePath}/backgrounds/house-foreground-trim-v1.png`,
    },
    roomShell: {
      key: "world-v1-background-room-shell",
      path: `${worldAssetBasePath}/backgrounds/house-room-shell-v1.png`,
    },
  },
  cats: {
    catAAwake: {
      key: "world-v1-cat-a-awake",
      path: `${worldAssetBasePath}/cats/cat-a-awake-v1.png`,
    },
    catBResting: {
      key: "world-v1-cat-b-resting",
      path: `${worldAssetBasePath}/cats/cat-b-resting-v1.png`,
    },
  },
  fx: {
    catShadow: {
      key: "world-v1-cat-shadow",
      path: `${worldAssetBasePath}/fx/cat-shadow-v1.png`,
    },
    hoverRing: {
      key: "world-v1-hover-ring",
      path: `${worldAssetBasePath}/fx/hover-ring-v1.png`,
    },
  },
  preloadEntries: [
    {
      key: "world-v1-background-room-shell",
      path: `${worldAssetBasePath}/backgrounds/house-room-shell-v1.png`,
    },
    {
      key: "world-v1-background-foreground-trim",
      path: `${worldAssetBasePath}/backgrounds/house-foreground-trim-v1.png`,
    },
    {
      key: "world-v1-prop-desk",
      path: `${worldAssetBasePath}/props/desk-v1.png`,
    },
    {
      key: "world-v1-prop-shelf",
      path: `${worldAssetBasePath}/props/shelf-v1.png`,
    },
    {
      key: "world-v1-prop-plant",
      path: `${worldAssetBasePath}/props/plant-v1.png`,
    },
    {
      key: "world-v1-prop-whiteboard",
      path: `${worldAssetBasePath}/props/whiteboard-v1.png`,
    },
    {
      key: "world-v1-prop-cabinet",
      path: `${worldAssetBasePath}/props/cabinet-v1.png`,
    },
    {
      key: "world-v1-prop-inbox-station",
      path: `${worldAssetBasePath}/props/inbox-station-v1.png`,
    },
    {
      key: "world-v1-cat-a-awake",
      path: `${worldAssetBasePath}/cats/cat-a-awake-v1.png`,
    },
    {
      key: "world-v1-cat-b-resting",
      path: `${worldAssetBasePath}/cats/cat-b-resting-v1.png`,
    },
    {
      key: "world-v1-cat-shadow",
      path: `${worldAssetBasePath}/fx/cat-shadow-v1.png`,
    },
    {
      key: "world-v1-hover-ring",
      path: `${worldAssetBasePath}/fx/hover-ring-v1.png`,
    },
    {
      key: "world-v1-ui-inspect-panel",
      path: `${worldAssetBasePath}/ui/inspect-panel-v1.png`,
    },
  ],
  props: {
    cabinet: {
      key: "world-v1-prop-cabinet",
      path: `${worldAssetBasePath}/props/cabinet-v1.png`,
    },
    desk: {
      key: "world-v1-prop-desk",
      path: `${worldAssetBasePath}/props/desk-v1.png`,
    },
    inboxStation: {
      key: "world-v1-prop-inbox-station",
      path: `${worldAssetBasePath}/props/inbox-station-v1.png`,
    },
    plant: {
      key: "world-v1-prop-plant",
      path: `${worldAssetBasePath}/props/plant-v1.png`,
    },
    shelf: {
      key: "world-v1-prop-shelf",
      path: `${worldAssetBasePath}/props/shelf-v1.png`,
    },
    whiteboard: {
      key: "world-v1-prop-whiteboard",
      path: `${worldAssetBasePath}/props/whiteboard-v1.png`,
    },
  },
  ui: {
    inspectPanel: {
      key: "world-v1-ui-inspect-panel",
      path: `${worldAssetBasePath}/ui/inspect-panel-v1.png`,
    },
  },
} as const;
