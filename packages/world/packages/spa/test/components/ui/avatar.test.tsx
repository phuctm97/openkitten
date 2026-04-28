import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "~/components/ui/avatar";

test("renders avatar primitives with the expected slots", () => {
  const { container } = render(
    <AvatarGroup>
      <Avatar>
        <AvatarFallback delayMs={0}>PC</AvatarFallback>
        <AvatarBadge>
          <span data-testid="avatar-badge-dot" />
        </AvatarBadge>
      </Avatar>
      <Avatar size="sm">
        <AvatarImage alt="Pixel Cat" src="/pixel-cat.png" />
      </Avatar>
      <AvatarGroupCount>+2</AvatarGroupCount>
    </AvatarGroup>,
  );

  expect(container.querySelector('[data-slot="avatar-group"]')).not.toBeNull();
  expect(
    container.querySelector('[data-slot="avatar-group-count"]'),
  ).toHaveTextContent("+2");

  const avatar = container.querySelector('[data-slot="avatar"]');

  expect(avatar).toHaveAttribute("data-size", "default");
  expect(
    container.querySelector(
      '[data-slot="avatar-badge"] [data-testid="avatar-badge-dot"]',
    ),
  ).not.toBeNull();
});
