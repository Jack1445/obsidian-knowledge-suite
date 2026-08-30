export interface CanvasReadyTimerHost {
  setTimeout(handler: () => void, timeout?: number): number;
  clearTimeout(handle?: number): void;
}

const DEFAULT_DELAYS_MS = [250, 600, 1200] as const;

export class CanvasReadySyncScheduler<TTarget extends object> {
  private readonly timers = new WeakMap<TTarget, number>();

  constructor(
    private readonly process: (target: TTarget) => Promise<boolean>,
    private readonly onError: (error: unknown) => void,
    private readonly delays: readonly number[] = DEFAULT_DELAYS_MS,
  ) {}

  public start(target: TTarget, host: CanvasReadyTimerHost): void {
    const previous = this.timers.get(target);
    if (previous !== undefined) host.clearTimeout(previous);
    this.schedule(target, host, 0);
  }

  private schedule(target: TTarget, host: CanvasReadyTimerHost, attempt: number): void {
    const delay = this.delays[attempt];
    if (delay === undefined) return;
    const timer = host.setTimeout(() => {
      this.timers.delete(target);
      void this.process(target)
        .then((processed) => {
          if (!processed) this.schedule(target, host, attempt + 1);
        })
        .catch(this.onError);
    }, delay);
    this.timers.set(target, timer);
  }
}
