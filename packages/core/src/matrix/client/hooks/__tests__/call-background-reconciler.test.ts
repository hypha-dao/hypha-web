import { describe, expect, it } from 'vitest';
import {
  type BackgroundReconcileOutcome,
  createBackgroundReconciler,
} from '../call-background-reconciler';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
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

  it('gives the latest request a pass even after many superseding requests', async () => {
    // Regression: a fixed pass cap could leave the last choice (e.g. None) unapplied.
    const seen: string[] = [];
    let state = 'image-0';
    const gates: Array<() => void> = [];
    const reconciler = createBackgroundReconciler(
      async (trigger, isSuperseded) => {
        const applying = state;
        const gate = deferred();
        gates.push(gate.resolve);
        await gate.promise;
        if (isSuperseded()) return 'superseded';
        seen.push(`${trigger}:${applying}`);
        return 'done';
      },
    );
    const run = reconciler.request('pick');
    for (let i = 1; i <= 8; i += 1) {
      await Promise.resolve();
      state = `image-${i}`;
      void reconciler.request('pick');
      gates.shift()?.();
    }
    state = 'none';
    void reconciler.request('pick');
    while (reconciler.isRunning) {
      gates.shift()?.();
      await new Promise((r) => setTimeout(r, 0));
    }
    await run;
    expect(seen.at(-1)).toBe('pick:none');
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

  it('drops a running pass on invalidate and survives a throwing pass', async () => {
    let superseded: boolean | null = null;
    const gate = deferred();
    const reconciler = createBackgroundReconciler(
      async (_trigger, isSuperseded) => {
        await gate.promise;
        superseded ??= isSuperseded();
        throw new Error('boom');
      },
    );
    const run = reconciler.request('x');
    reconciler.invalidate();
    gate.resolve();
    await run;
    expect(superseded).toBe(true);
    expect(reconciler.isRunning).toBe(false);
  });
});
