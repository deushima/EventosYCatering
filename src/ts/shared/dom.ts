export const query = <T extends Element>(
  selector: string,
  root: ParentNode = document
): T | null => root.querySelector<T>(selector);

export const queryAll = <T extends Element>(
  selector: string,
  root: ParentNode = document
): T[] => Array.from(root.querySelectorAll<T>(selector));

export const setStyles = (
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>
): void => {
  Object.assign(element.style, styles);
};
