import { describe, expect, it } from 'vitest';
import {
  type BackgroundReconcileOutcome,
  type BackgroundReconcilePass,
  createBackgroundReconciler,
} from '../call-background-reconciler';

/**
 * A pass that blocks until released, with an explicit signal when each pass starts, so a test
 * can interleave requests with passes deterministically.
 */
function gatedPass(apply: (isSuperseded: () => boolean) => void) {
  const starts: Array<() => void> = [];
  let passesStarted = 0;
  let notifyStart: (() => void) | null = null;
  const pass: BackgroundReconcilePass = async (_trigger, isSuperseded) => {
    passesStarted += 1;
    notifyStart?.();
    await new Promise<void>((release) => starts.push(release));
    if (isSuperseded()) return 'superseded';
    apply(isSuperseded);
    return 'done';
  };
  return {
    pass,
    get passesStarted() {
      return passesStarted;
    },
    /** Resolves once the next pass has started. */
    nextStart: () =>
      new Promise<void>((resolve) => {
        notifyStart = () => {
          notifyStart = null;
          resolve();
        };
      }),
    releaseCurrent: () => starts.shift()?.(),
  };
}

describe('createBackgroundReconciler', () => {
  it('runs one pass at a time', async () => {
    let active = 0;
    let maxActive = 0;
    const reconciler = createBackgroundReconciler(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return 'done';
    });
    const first = reconciler.request('a');
    void reconciler.request('b');
    void reconciler.request('c');
    await first;
    expect(maxActive).toBe(1);
  });

  it('applies the latest choice after more than five superseded passes', async () => {
    // Regression: a fixed five-pass cap could leave the last choice (e.g. None) unapplied.
    let choice = 'image-0';
    const applied: string[] = [];
    const gate = gatedPass(() => applied.push(choice));
    const reconciler = createBackgroundReconciler(gate.pass);

    let started = gate.nextStart();
    const run = reconciler.request('pick');
    await started;
    for (let i = 1; i <= 7; i += 1) {
      choice = `image-${i}`;
      void reconciler.request('pick'); // supersedes the running pass
      started = gate.nextStart();
      gate.releaseCurrent();
      await started; // the next pass has really begun
    }
    expect(gate.passesStarted).toBeGreaterThan(5);
    choice = 'none';
    void reconciler.request('pick');
    started = gate.nextStart();
    gate.releaseCurrent();
    await started;
    gate.releaseCurrent();
    await run;
    expect(applied).toEqual(['none']);
  });

  it('caps retries when nothing newer arrives', async () => {
    let passes = 0;
    const reconciler = createBackgroundReconciler(
      async () => {
        passes += 1;
        return 'retry' as BackgroundReconcileOutcome;
      },
      { maxRetries: 3 },
    );
    await reconciler.request('x');
    expect(passes).toBe(3);
  });

  it('marks a pass superseded when the camera epoch changes', async () => {
    let epoch = 0;
    let superseded: boolean | null = null;
    const reconciler = createBackgroundReconciler(
      async (_trigger, isSuperseded) => {
        epoch += 1;
        superseded = isSuperseded();
        return 'superseded';
      },
      { epoch: () => epoch },
    );
    await reconciler.request('camera-on');
    expect(superseded).toBe(true);
  });

  it('invalidate drops the running pass without owing another one', async () => {
    const gate = gatedPass(() => undefined);
    const reconciler = createBackgroundReconciler(gate.pass);
    const started = gate.nextStart();
    const run = reconciler.request('x');
    await started;
    reconciler.invalidate();
    gate.releaseCurrent();
    await run;
    expect(gate.passesStarted).toBe(1);
  });

  it('a request made after invalidate still gets its pass', async () => {
    const applied: string[] = [];
    const gate = gatedPass(() => applied.push('after'));
    const reconciler = createBackgroundReconciler(gate.pass);
    let started = gate.nextStart();
    const run = reconciler.request('x');
    await started;
    reconciler.invalidate();
    void reconciler.request('y');
    started = gate.nextStart();
    gate.releaseCurrent();
    await started;
    gate.releaseCurrent();
    await run;
    expect(gate.passesStarted).toBe(2);
    expect(applied).toEqual(['after']);
  });

  it('survives a throwing pass', async () => {
    const reconciler = createBackgroundReconciler(async () => {
      throw new Error('boom');
    });
    await reconciler.request('x');
    expect(reconciler.isRunning).toBe(false);
  });
});
