import { consola } from "consola";
import { beforeEach, vi } from "vitest";

beforeEach(() => {
  consola.mockTypes(() => vi.fn());
});
