import type { CanvasReadyTimerHost } from "./CanvasReadySyncScheduler";

const BUSY_RETRY_INTERVAL_MS = 50;
const MAX_BUSY_RETRIES = 200;

export class CanvasSaveSyncCoordinator<TTarget extends object> {
  constructor(
    private readonly isBusy: (target: TTarget) => boolean,
    private readonly captureSavedScene: (target: TTarget) => Promise<boolean>,
  ) {}

  public async flush(target: TTarget, host: CanvasReadyTimerHost): Promise<boolean> {
    let retries = 0;
    while (this.isBusy(target) && retries < MAX_BUSY_RETRIES) {
      retries += 1;
      await new Promise<void>((resolve) => {
        host.setTimeout(resolve, BUSY_RETRY_INTERVAL_MS);
      });
    }
    if (this.isBusy(target)) return false;
    return this.captureSavedScene(target);
  }
}
