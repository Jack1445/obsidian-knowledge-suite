export const shouldPanSemanticFilterViewport = (
  button: number,
  pointerOverCard: boolean,
): boolean => button === 1 || (button === 0 && !pointerOverCard);
