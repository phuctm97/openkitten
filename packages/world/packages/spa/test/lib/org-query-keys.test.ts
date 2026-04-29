import { expect, it } from "vitest";
import { orgQueryKeys } from "~/lib/org-query-keys";

it("exposes a scope tree under the organizations namespace", () => {
  expect(orgQueryKeys).toStrictEqual({
    all: ["organizations"],
    list: ["organizations", "list"],
    full: ["organizations", "full"],
    members: ["organizations", "members"],
    invitations: ["organizations", "invitations"],
    invitation: ["organizations", "invitation"],
  });
});
