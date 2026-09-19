/**
 * Guards asynchronous view work when Obsidian reuses one leaf for another file.
 * These functions are deliberately side-effect free so the load/save boundary
 * can be regression-tested without opening a vault or touching canvas files.
 */
export function isCurrentViewLoad<T>(
  currentFile: T | null,
  expectedFile: T | null,
  currentGeneration: number,
  expectedGeneration: number,
): boolean {
  return Boolean(
    expectedFile &&
      isSameFile(currentFile, expectedFile) &&
      currentGeneration === expectedGeneration,
  );
}

export function isSameFile<T>(left: T | null, right: T | null): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  const leftPath = (left as { path?: unknown }).path;
  const rightPath = (right as { path?: unknown }).path;
  return typeof leftPath === "string" && leftPath === rightPath;
}

export function isStableViewForFile<T>(
  currentFile: T | null,
  expectedFile: T | null,
  currentGeneration: number,
  expectedGeneration: number,
  lastLoadedFile: T | null,
  dataFile: T | null,
): boolean {
  return Boolean(
    isCurrentViewLoad(
      currentFile,
      expectedFile,
      currentGeneration,
      expectedGeneration,
    ) &&
      (!lastLoadedFile || isSameFile(lastLoadedFile, expectedFile)) &&
      isSameFile(dataFile, expectedFile),
  );
}
