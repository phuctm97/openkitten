import { expect, test } from "vitest";
import type { ContractInputs, ContractOutputs } from "../lib/index";
import { contract } from "../lib/index";

test("exports contract with getBotToken", () => {
  expect(contract.getBotToken).toBeDefined();
});

test("ContractInputs type is assignable", () => {
  const _input: ContractInputs = { getBotToken: undefined };
  expect(_input).toBeDefined();
});

test("ContractOutputs type is assignable", () => {
  const _output: ContractOutputs = { getBotToken: "token" };
  expect(_output).toBeDefined();
});
