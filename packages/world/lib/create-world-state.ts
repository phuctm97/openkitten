import { worldFixture } from "~/lib/world-fixture";

type WorldState = {
  world: typeof worldFixture;
  focus:
    | {
        kind: "overview";
      }
    | {
        kind: "cat";
        id: string;
      }
    | {
        kind: "thread";
        id: string;
      }
    | {
        kind: "session";
        id: string;
      }
    | {
        kind: "inbox";
      }
    | {
        kind: "whiteboard";
      }
    | {
        kind: "cabinet";
      };
  worldClock: number;
  reaction: null | {
    catId: string;
    message: string;
    startedAt: number;
  };
  nextCommentNumber: number;
  nextActivityNumber: number;
};

function createWorldState(): WorldState {
  return {
    world: structuredClone(worldFixture),
    focus: {
      kind: "overview",
    },
    worldClock: 0,
    reaction: null,
    nextCommentNumber: 5,
    nextActivityNumber: 5,
  };
}

export { createWorldState };
