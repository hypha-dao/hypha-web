import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPairwiseRepublishSchedule,
  resetPairwiseRepublishScheduleForTests,
  scheduleRepublishLocalMediaToPairwiseCalls,
} from '../call-pairwise-republish-schedule';
import * as restart from '../call-pairwise-restart';

describe('scheduleRepublishLocalMediaToPairwiseCalls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetPairwiseRepublishScheduleForTests();
    vi.spyOn(restart, 'republishLocalMediaToPairwiseCalls').mockResolvedValue(
      1,
    );
  });

  it('debounces rapid schedule calls into one republish', async () => {
    const gc = { id: 'gc' };
    scheduleRepublishLocalMediaToPairwiseCalls(gc, { delayMs: 1000 });
    scheduleRepublishLocalMediaToPairwiseCalls(gc, { delayMs: 1000 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(restart.republishLocalMediaToPairwiseCalls).toHaveBeenCalledTimes(1);
  });

  it('clears pending republish on cleanup', async () => {
    const gc = { id: 'gc' };
    scheduleRepublishLocalMediaToPairwiseCalls(gc, { delayMs: 1000 });
    clearPairwiseRepublishSchedule();
    await vi.advanceTimersByTimeAsync(5000);
    expect(restart.republishLocalMediaToPairwiseCalls).not.toHaveBeenCalled();
  });
});
