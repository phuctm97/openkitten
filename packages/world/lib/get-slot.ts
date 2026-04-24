export function getSlot(slot: string) {
  const element = document.querySelector(`[data-slot="${slot}"]`);

  if (!element) {
    throw new Error(`Missing slot ${slot}`);
  }

  return element;
}
