export interface HoldFireClock {
  now(): number;
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}
/** One monotonic clock, one timer. Rendering cadence never determines shot count. */
export class HoldFireController {
  private handle: unknown = null;
  private owner: string | null = null;
  private generation = 0;
  private started = 0;
  private first = 0;
  private interval = 0;
  constructor(private clock: HoldFireClock, private callbacks: {
    start(): void; tick(elapsedMs: number): void; stop(elapsedMs: number): void;
  }) {}
  get active() { return this.owner !== null; }
  start(owner: string, firstDelayMs: number, intervalMs: number): boolean {
    if (this.active || !Number.isFinite(firstDelayMs) || firstDelayMs < 0 || !Number.isFinite(intervalMs) || intervalMs <= 0) return false;
    this.owner = owner; this.started = this.clock.now(); this.first = firstDelayMs; this.interval = intervalMs;
    const generation = ++this.generation;
    this.callbacks.start(); this.arm(generation, firstDelayMs);
    return true;
  }
  private arm(generation: number, delay: number) {
    this.handle = this.clock.schedule(()=>{
      if (!this.active || generation !== this.generation) return;
      this.handle = null;
      const elapsed = Math.max(0, this.clock.now() - this.started);
      this.callbacks.tick(elapsed);
      if (!this.active || generation !== this.generation) return;
      const index = Math.max(0, Math.floor((elapsed-this.first)/this.interval)+1);
      this.arm(generation, Math.max(1, this.first + index*this.interval - (this.clock.now()-this.started)));
    },Math.max(0,delay));
  }
  stop(owner?: string): boolean {
    if (!this.active || (owner !== undefined && owner !== this.owner)) return false;
    const elapsed = Math.max(0,this.clock.now()-this.started);
    this.cancel(); this.callbacks.stop(elapsed); return true;
  }
  cancel() {
    ++this.generation; this.owner = null;
    if (this.handle !== null) this.clock.cancel(this.handle);
    this.handle = null;
  }
}

export function bindHoldSafety(controller: HoldFireController, win: EventTarget, doc: EventTarget & { visibilityState: string }) {
  const stop = ()=>controller.stop();
  const hidden = ()=>{ if (doc.visibilityState !== 'visible') stop(); };
  const release = (event: Event)=>controller.stop(`pointer:${(event as PointerEvent).pointerId}`);
  win.addEventListener('blur',stop); win.addEventListener('pagehide',stop);
  win.addEventListener('pointerup',release); win.addEventListener('pointercancel',release);
  doc.addEventListener('visibilitychange',hidden);
  return ()=>{
    win.removeEventListener('blur',stop); win.removeEventListener('pagehide',stop);
    win.removeEventListener('pointerup',release); win.removeEventListener('pointercancel',release);
    doc.removeEventListener('visibilitychange',hidden); controller.cancel();
  };
}
