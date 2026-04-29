export function closestForm(element: Element): HTMLFormElement {
  const form = element.closest("form");
  if (!form) throw new Error("expected element to be inside a <form>");
  return form;
}
