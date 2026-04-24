export class StubResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  disconnect() {}

  observe(target: Element) {
    const size: ResizeObserverSize = { blockSize: 200, inlineSize: 320 };

    this.callback(
      [
        {
          borderBoxSize: [size],
          contentBoxSize: [size],
          contentRect: new DOMRect(0, 0, 320, 200),
          devicePixelContentBoxSize: [size],
          target,
        },
      ],
      this,
    );
  }

  unobserve() {}
}
