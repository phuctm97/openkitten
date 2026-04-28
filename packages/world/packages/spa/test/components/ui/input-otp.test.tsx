import { render, screen } from "@testing-library/react";
import { OTPInputContext, type RenderProps } from "input-otp";
import { expect, test } from "vitest";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "~/components/ui/input-otp";
import { getSlot } from "~/lib/get-slot";

test("renders otp input slots", () => {
  render(
    <InputOTP maxLength={6} value="12" onChange={() => {}}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
      </InputOTPGroup>
      <InputOTPSeparator />
    </InputOTP>,
  );

  expect(getSlot("input-otp")).toBeInTheDocument();
  expect(screen.getByText("1")).toHaveAttribute("data-slot", "input-otp-slot");
  expect(getSlot("input-otp-separator")).toHaveAttribute("role", "separator");
});

test("renders otp slot fake caret from context", () => {
  const context = {
    isFocused: true,
    isHovering: false,
    slots: [
      {
        char: null,
        hasFakeCaret: true,
        isActive: true,
        placeholderChar: null,
      },
    ],
  } satisfies RenderProps;

  render(
    <OTPInputContext.Provider value={context}>
      <InputOTPSlot index={0} />
    </OTPInputContext.Provider>,
  );

  expect(getSlot("input-otp-slot")).toHaveAttribute("data-active", "true");
  expect(document.querySelector(".animate-caret-blink")).toBeInTheDocument();
});

test("renders otp slot without context", () => {
  render(
    <OTPInputContext.Provider
      value={{ isFocused: false, isHovering: false, slots: [] }}
    >
      <InputOTPSlot index={99} />
    </OTPInputContext.Provider>,
  );

  expect(getSlot("input-otp-slot")).not.toHaveAttribute("data-active", "true");
});
