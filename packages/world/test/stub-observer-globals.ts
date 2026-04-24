import { vi } from "vitest";
import { StubResizeObserver } from "~/test/stub-resize-observer";

export function stubObserverGlobals() {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  Element.prototype.scrollIntoView = vi.fn();
}
