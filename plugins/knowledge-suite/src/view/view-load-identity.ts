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
      currentFile === expectedFile &&
      currentGeneration === expectedGeneration,
  );
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
      lastLoadedFile === expectedFile &&
      dataFile === expectedFile,
  );
}
