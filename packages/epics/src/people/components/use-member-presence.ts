'use client';

import { useEffect, useMemo, useState } from 'react';
import { UserEvent } from 'matrix-js-sdk';
import {
  useMatrix,
  useMatrixUserIdsByPersonIds,
} from '@hypha-platform/core/client';

import { readMemberPresence, type PresenceLevel } from './member-presence';

function samePresence(
  left: Map<number, PresenceLevel>,
  right: Map<number, PresenceLevel>,
) {
  if (left.size !== right.size) return false;
  for (const [id, level] of left) {
    if (right.get(id) !== level) return false;
  }
  return true;
}

/** Live Matrix presence for a set of people, polled and event-driven. */
export function useMemberPresence(personIds: readonly number[]) {
  const matrix = useMatrix();
  const ids = useMemo(() => [...personIds], [personIds]);
  const { personIdToMatrixUserId, isLoading: matrixIdsLoading } =
    useMatrixUserIdsByPersonIds({ personIds: ids });
  const [presenceById, setPresenceById] = useState<Map<
    number,
    PresenceLevel
  > | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      setPresenceById((current) =>
        current && current.size === 0 ? current : new Map(),
      );
      return;
    }
    const client = matrix.client;
    if (!client || !matrix.isAuthenticated || matrixIdsLoading) return;

    let cancelled = false;
    let timer = 0;
    const recompute = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void (async () => {
          const next = new Map<number, PresenceLevel>();
          await Promise.all(
            ids.map(async (personId) => {
              const matrixUserId = personIdToMatrixUserId[personId];
              if (!matrixUserId) {
                next.set(personId, 'offline');
                return;
              }
              next.set(
                personId,
                await readMemberPresence(client, matrixUserId),
              );
            }),
          );
          if (cancelled) return;
          setPresenceById((current) =>
            current && samePresence(current, next) ? current : next,
          );
        })();
      }, 250);
    };

    recompute();
    const interval = window.setInterval(recompute, 30_000);
    client.on(UserEvent.Presence, recompute);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      client.removeListener(UserEvent.Presence, recompute);
    };
  }, [
    ids,
    matrix.client,
    matrix.isAuthenticated,
    matrixIdsLoading,
    personIdToMatrixUserId,
  ]);

  return {
    presenceById: presenceById ?? new Map<number, PresenceLevel>(),
    isLoading: presenceById == null && ids.length > 0,
  };
}
