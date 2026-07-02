import { describe, expect, it, beforeEach } from 'vitest';
import type { Coherence } from '../../types';
import {
  applyPendingCoherenceTaskPatch,
  clearPendingCoherenceTaskPatch,
  mergePendingCoherenceTaskPatches,
} from '../useFindCoherences';

function makeSignal(
  overrides: Partial<Coherence> & Pick<Coherence, 'slug'>,
): Coherence {
  return {
    id: 1,
    creatorId: 1,
    spaceId: 1,
    title: 'Signal',
    description: 'Body',
    type: 'Opportunity',
    priority: 'medium',
    tags: [],
    archived: false,
    messages: 0,
    views: 0,
    roomId: undefined,
    dueAt: null,
    progressStatus: 'backlog',
    board: null,
    assigneeIds: [],
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    updatedAt: new Date('2026-07-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('mergePendingCoherenceTaskPatches', () => {
  beforeEach(() => {
    clearPendingCoherenceTaskPatch('space-a', 'signal-1');
  });

  it('overlays optimistic status before PATCH completes', () => {
    applyPendingCoherenceTaskPatch('space-a', 'signal-1', {
      progressStatus: 'done',
    });

    const [merged] = mergePendingCoherenceTaskPatches('space-a', [
      makeSignal({ slug: 'signal-1', progressStatus: 'backlog' }),
    ]);

    expect(merged?.progressStatus).toBe('done');
  });

  it('keeps overlay when a stale refetch returns the previous status', () => {
    applyPendingCoherenceTaskPatch('space-a', 'signal-1', {
      progressStatus: 'done',
    });

    const [mergedFromStaleFetch] = mergePendingCoherenceTaskPatches(
      'space-a',
      [
        makeSignal({
          slug: 'signal-1',
          progressStatus: 'backlog',
          updatedAt: new Date('2026-07-01T10:00:00.000Z'),
        }),
      ],
      { fromFetch: true },
    );

    expect(mergedFromStaleFetch?.progressStatus).toBe('done');
  });

  it('keeps overlay after PATCH when refetch still has the old status and updatedAt', () => {
    const confirmedAt = new Date('2026-07-01T10:00:00.000Z').getTime();
    applyPendingCoherenceTaskPatch('space-a', 'signal-1', {
      progressStatus: 'done',
      confirmedUpdatedAtMs: confirmedAt,
    });

    const [mergedFromStaleFetch] = mergePendingCoherenceTaskPatches(
      'space-a',
      [
        makeSignal({
          slug: 'signal-1',
          progressStatus: 'backlog',
          updatedAt: new Date('2026-07-01T10:00:00.000Z'),
        }),
      ],
      { fromFetch: true },
    );

    expect(mergedFromStaleFetch?.progressStatus).toBe('done');
  });

  it('clears overlay after a fresh refetch confirms the move', () => {
    const confirmedAt = new Date('2026-07-01T12:00:00.000Z').getTime();
    applyPendingCoherenceTaskPatch('space-a', 'signal-1', {
      progressStatus: 'done',
      confirmedUpdatedAtMs: confirmedAt,
    });

    mergePendingCoherenceTaskPatches(
      'space-a',
      [
        makeSignal({
          slug: 'signal-1',
          progressStatus: 'done',
          updatedAt: new Date('2026-07-01T12:00:00.000Z'),
        }),
      ],
      { fromFetch: true },
    );

    const [merged] = mergePendingCoherenceTaskPatches('space-a', [
      makeSignal({
        slug: 'signal-1',
        progressStatus: 'done',
        updatedAt: new Date('2026-07-01T12:00:00.000Z'),
      }),
    ]);

    expect(merged?.progressStatus).toBe('done');
  });

  it('does not clear overlay on refetch before PATCH confirms', () => {
    applyPendingCoherenceTaskPatch('space-a', 'signal-1', {
      progressStatus: 'done',
    });

    mergePendingCoherenceTaskPatches(
      'space-a',
      [
        makeSignal({
          slug: 'signal-1',
          progressStatus: 'done',
          updatedAt: new Date('2026-07-01T12:00:00.000Z'),
        }),
      ],
      { fromFetch: true },
    );

    const [merged] = mergePendingCoherenceTaskPatches('space-a', [
      makeSignal({
        slug: 'signal-1',
        progressStatus: 'backlog',
        updatedAt: new Date('2026-07-01T10:00:00.000Z'),
      }),
    ]);

    expect(merged?.progressStatus).toBe('done');
  });
});
