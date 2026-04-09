import type { Cat } from "~/lib/cat";

export const houseCats = [
  {
    cat: {
      activeGoal: "Triage the whiteboard notes before the next work cycle.",
      activeSessionLabel: "Inbox review",
      assignedThreadIds: ["thread-inbox-triage", "thread-roadmap"],
      id: "cat-a",
      name: "Mochi",
      state: "awake",
    },
    floorHeight: 60,
    floorWidth: 170,
    floorY: 714,
    position: {
      x: 560,
      y: 620,
    },
    spriteSize: 232,
    textureKey: "cat-a-awake-v1",
    texturePath: "/world/v1/cats/cat-a-awake-v1.png",
  },
  {
    cat: {
      activeGoal: "Rest on the rug until the next thread sweep begins.",
      activeSessionLabel: "Nap watch",
      assignedThreadIds: ["thread-garden", "thread-housekeeping"],
      id: "cat-b",
      name: "Juniper",
      state: "resting",
    },
    floorHeight: 72,
    floorWidth: 214,
    floorY: 824,
    position: {
      x: 332,
      y: 768,
    },
    spriteSize: 252,
    textureKey: "cat-b-resting-v1",
    texturePath: "/world/v1/cats/cat-b-resting-v1.png",
  },
] as const satisfies ReadonlyArray<{
  cat: Cat;
  floorHeight: number;
  floorWidth: number;
  floorY: number;
  position: {
    x: number;
    y: number;
  };
  spriteSize: number;
  textureKey: string;
  texturePath: string;
}>;
