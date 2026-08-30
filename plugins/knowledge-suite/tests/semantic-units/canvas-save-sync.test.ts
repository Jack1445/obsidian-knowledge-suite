import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasReadyTimerHost } from "../../src/features/semantic-units/CanvasReadySyncScheduler";
import { CanvasSaveSyncCoordinator } from "../../src/features/semantic-units/CanvasSaveSyncCoordinator";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("semantic unit save synchronization", () => {
  it("waits for an in-flight scene task before capturing the saved scene", async () => {
    vi.useFakeTimers();
    let busy = true;
    const capture = vi.fn().mockResolvedValue(true);
    const coordinator = new CanvasSaveSyncCoordinator<object>(() => busy, capture);
    const host: CanvasReadyTimerHost = {
      setTimeout: (handler, timeout) => setTimeout(handler, timeout) as unknown as number,
      clearTimeout: (handle) => clearTimeout(handle),
    };
    const target = {};

    const flushing = coordinator.flush(target, host);
    await vi.advanceTimersByTimeAsync(100);
    expect(capture).not.toHaveBeenCalled();

    busy = false;
    await vi.advanceTimersByTimeAsync(50);
    await expect(flushing).resolves.toBe(true);
    expect(capture).toHaveBeenCalledOnce();
  });

  it("captures immediately when no scene task is active", async () => {
    const capture = vi.fn().mockResolvedValue(true);
    const coordinator = new CanvasSaveSyncCoordinator<object>(() => false, capture);
    const host: CanvasReadyTimerHost = {
      setTimeout: (handler, timeout) => setTimeout(handler, timeout) as unknown as number,
      clearTimeout: (handle) => clearTimeout(handle),
    };

    await expect(coordinator.flush({}, host)).resolves.toBe(true);
    expect(capture).toHaveBeenCalledOnce();
  });
});
