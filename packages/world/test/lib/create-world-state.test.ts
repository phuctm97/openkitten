import { expect, test } from "vitest";

import { createWorldState } from "~/lib/create-world-state";
import { worldFixture } from "~/lib/world-fixture";

test("creates a fresh serializable world state from the fixture", () => {
  const state = createWorldState();

  expect(state.focus).toEqual({
    kind: "overview",
  });
  expect(state.worldClock).toBe(0);
  expect(state.nextCommentNumber).toBe(5);
  expect(state.nextActivityNumber).toBe(5);

  const firstCat = state.world.cats[0];

  if (firstCat) {
    firstCat.name = "Changed";
  }

  expect(worldFixture.cats[0]?.name).toBe("Mochi");
});
