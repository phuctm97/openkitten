import { expect, test } from "vitest";

import { worldFixture } from "~/lib/world-fixture";

test("defines the fixed MVP house slice", () => {
  expect(worldFixture.house.name).toBe("Lantern House");
  expect(worldFixture.human.name).toBe("Mina");
  expect(worldFixture.cats.map((cat) => cat.name)).toEqual(["Mochi", "Pepper"]);
  expect(worldFixture.goals).toHaveLength(2);
  expect(worldFixture.threads).toHaveLength(3);
  expect(worldFixture.notices).toHaveLength(3);
  expect(worldFixture.session.catId).toBe("cat-mochi");
  expect(worldFixture.whiteboard.cues).toHaveLength(3);
  expect(worldFixture.cabinet.files).toHaveLength(3);
});
