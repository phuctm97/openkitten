import { expect, it } from "vitest";
import { orgMutationKeys } from "~/lib/org-mutation-keys";

it("exposes the mutation scope keys used by the better-auth-ui registry components", () => {
  expect(orgMutationKeys).toStrictEqual({
    organizations: ["organizations"],
    active: ["active-organization"],
  });
});
