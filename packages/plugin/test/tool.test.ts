import { expect, test } from "vitest";
import { tool } from "../lib/tool";

test("re-exports tool function from @opencode-ai/plugin", () => {
  expect(typeof tool).toBe("function");
});

test("tool.schema exposes zod", () => {
  expect(tool.schema).toBeDefined();
  expect(typeof tool.schema.string).toBe("function");
});

test("tool returns definition with description and args", () => {
  const def = tool({
    description: "test tool",
    args: {
      input: tool.schema.string().describe("test input"),
    },
    async execute(args) {
      return `hello ${args.input}`;
    },
  });
  expect(def.description).toBe("test tool");
  expect(def.args).toBeDefined();
  expect(typeof def.execute).toBe("function");
});
