import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CanvasReadySyncScheduler,
  type CanvasReadyTimerHost,
} from "../../src/features/semantic-units/CanvasReadySyncScheduler";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("semantic unit canvas-ready synchronization", () => {
  it("retries a skipped first-open sync and stops immediately after success", async () => {
    vi.useFakeTimers();
    const process = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const onError = vi.fn();
    const scheduler = new CanvasReadySyncScheduler<object>(process, onError);
    const host: CanvasReadyTimerHost = {
      setTimeout: (handler, timeout) => setTimeout(handler, timeout) as unknown as number,
      clearTimeout: (handle) => clearTimeout(handle),
    };
    const target = {};

    scheduler.start(target, host);
    await vi.advanceTimersByTimeAsync(250);
    expect(process).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(600);
    expect(process).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2000);
    expect(process).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("cancels a pending attempt when the same canvas reports ready again", async () => {
    vi.useFakeTimers();
    const process = vi.fn().mockResolvedValue(true);
    const scheduler = new CanvasReadySyncScheduler<object>(process, vi.fn());
    const host: CanvasReadyTimerHost = {
      setTimeout: (handler, timeout) => setTimeout(handler, timeout) as unknown as number,
      clearTimeout: (handle) => clearTimeout(handle),
    };
    const target = {};

    scheduler.start(target, host);
    await vi.advanceTimersByTimeAsync(100);
    scheduler.start(target, host);
    await vi.advanceTimersByTimeAsync(250);

    expect(process).toHaveBeenCalledTimes(1);
  });
});
