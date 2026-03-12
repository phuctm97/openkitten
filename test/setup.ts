import { consola, LogLevels } from "consola";
import { beforeEach, vi } from "vitest";

beforeEach(() => {
  consola.level = LogLevels.info;
  consola.mockTypes(() => vi.fn());
});
