'use client';

import React from 'react';
import {
  applyPendingCoherenceTaskPatch,
  clearPendingCoherenceTaskPatch,
  setPendingCoherenceTaskPatch,
  upsertCoherenceInSpaceCache,
  usePatchCoherenceTask,
  type Coherence,
} from '@hypha-platform/core/client';

/**
 * Moves a signal to another board from the swimlanes (#2765). Optimistic:
 * the signal shows on the new row at once, through the same pending-patch
 * cache the old board view used, and goes back if the server refuses.
 */
export function useMoveSignalToBoard(spaceSlug: string) {
  const { patchTask } = usePatchCoherenceTask(spaceSlug);

  return React.useCallback(
    async (signal: Coherence, board: string) => {
      const slug = signal.slug?.trim();
      if (!slug) return;
      const taskPatch = { board };
      applyPendingCoherenceTaskPatch(spaceSlug, slug, taskPatch);
      void upsertCoherenceInSpaceCache(spaceSlug, { ...signal, ...taskPatch });
      try {
        const updated = await patchTask({ slug, ...taskPatch });
        const updatedAt =
          updated.updatedAt instanceof Date
            ? updated.updatedAt
            : new Date(updated.updatedAt);
        setPendingCoherenceTaskPatch(spaceSlug, slug, {
          ...taskPatch,
          confirmedUpdatedAtMs: updatedAt.getTime(),
        });
        void upsertCoherenceInSpaceCache(spaceSlug, {
          ...updated,
          ...taskPatch,
        });
      } catch (error) {
        clearPendingCoherenceTaskPatch(spaceSlug, slug);
        void upsertCoherenceInSpaceCache(spaceSlug, signal);
        console.error('[useMoveSignalToBoard] Failed to move signal', error);
      }
    },
    [patchTask, spaceSlug],
  );
}
