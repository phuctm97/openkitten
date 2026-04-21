import { expect, test } from "vitest";
import type { ContractInputs, ContractOutputs } from "~/lib/main";
import { contract, getBotToken } from "~/lib/main";

test("exports contract with getBotToken", () => {
  expect(contract.getBotToken).toBeDefined();
});

test("exports getBotToken", () => {
  expect(typeof getBotToken).toBe("function");
});

test("ContractInputs type is assignable", () => {
  const _input: ContractInputs = { getBotToken: undefined };
  expect(_input).toBeDefined();
});

test("ContractOutputs type is assignable", () => {
  const _output: ContractOutputs = { getBotToken: "token" };
  expect(_output).toBeDefined();
});
