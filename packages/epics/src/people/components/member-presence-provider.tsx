'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { UserEvent } from 'matrix-js-sdk';
import { useMatrix } from '@hypha-platform/core/client';

import { readMemberPresence, type PresenceLevel } from './member-presence';
import { useMemberPresence } from './use-member-presence';

type PresenceRegistryValue = {
  getByPersonId: (personId: number) => PresenceLevel;
  getByMatrixUserId: (matrixUserId: string) => PresenceLevel;
  registerPersonId: (personId: number) => void;
  unregisterPersonId: (personId: number) => void;
  registerMatrixUserId: (matrixUserId: string) => void;
  unregisterMatrixUserId: (matrixUserId: string) => void;
};

const PresenceRegistryContext = createContext<PresenceRegistryValue | null>(
  null,
);

function sortedKeys(map: Map<string, number>): string[] {
  return [...map.keys()].sort();
}

function sortedNumberKeys(map: Map<number, number>): number[] {
  return [...map.keys()].sort((a, b) => a - b);
}

function sameStringList(left: string[], right: string[]) {
  return (
    left.length === right.length && left.every((value, i) => value === right[i])
  );
}

function sameNumberList(left: number[], right: number[]) {
  return (
    left.length === right.length && left.every((value, i) => value === right[i])
  );
}

function samePresenceMap(
  left: Map<string, PresenceLevel>,
  right: Map<string, PresenceLevel>,
) {
  if (left.size !== right.size) return false;
  for (const [id, level] of left) {
    if (right.get(id) !== level) return false;
  }
  return true;
}

/** Batches Matrix presence for every registered circle portrait in the tree. */
export function MemberPresenceProvider({ children }: { children: ReactNode }) {
  const matrix = useMatrix();
  const personCountsRef = useRef(new Map<number, number>());
  const matrixCountsRef = useRef(new Map<string, number>());
  const [personIds, setPersonIds] = useState<number[]>([]);
  const [matrixUserIds, setMatrixUserIds] = useState<string[]>([]);
  const [matrixPresenceById, setMatrixPresenceById] = useState<Map<
    string,
    PresenceLevel
  > | null>(null);

  const syncPersonIds = useCallback(() => {
    const next = sortedNumberKeys(personCountsRef.current);
    setPersonIds((current) => (sameNumberList(current, next) ? current : next));
  }, []);

  const syncMatrixUserIds = useCallback(() => {
    const next = sortedKeys(matrixCountsRef.current);
    setMatrixUserIds((current) =>
      sameStringList(current, next) ? current : next,
    );
  }, []);

  const registerPersonId = useCallback(
    (personId: number) => {
      if (!Number.isFinite(personId) || personId <= 0) return;
      const prev = personCountsRef.current.get(personId) ?? 0;
      personCountsRef.current.set(personId, prev + 1);
      if (prev === 0) syncPersonIds();
    },
    [syncPersonIds],
  );

  const unregisterPersonId = useCallback(
    (personId: number) => {
      const prev = personCountsRef.current.get(personId) ?? 0;
      if (prev <= 1) {
        personCountsRef.current.delete(personId);
        syncPersonIds();
      } else {
        personCountsRef.current.set(personId, prev - 1);
      }
    },
    [syncPersonIds],
  );

  const registerMatrixUserId = useCallback(
    (matrixUserId: string) => {
      const id = matrixUserId.trim();
      if (!id) return;
      const prev = matrixCountsRef.current.get(id) ?? 0;
      matrixCountsRef.current.set(id, prev + 1);
      if (prev === 0) syncMatrixUserIds();
    },
    [syncMatrixUserIds],
  );

  const unregisterMatrixUserId = useCallback(
    (matrixUserId: string) => {
      const id = matrixUserId.trim();
      const prev = matrixCountsRef.current.get(id) ?? 0;
      if (prev <= 1) {
        matrixCountsRef.current.delete(id);
        syncMatrixUserIds();
      } else {
        matrixCountsRef.current.set(id, prev - 1);
      }
    },
    [syncMatrixUserIds],
  );

  const { presenceById: personPresenceById } = useMemberPresence(personIds);

  useEffect(() => {
    if (matrixUserIds.length === 0) {
      setMatrixPresenceById((current) =>
        current && current.size === 0 ? current : new Map(),
      );
      return;
    }
    const client = matrix.client;
    if (!client || !matrix.isAuthenticated) return;

    let cancelled = false;
    let timer = 0;
    const recompute = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void (async () => {
          const next = new Map<string, PresenceLevel>();
          await Promise.all(
            matrixUserIds.map(async (matrixUserId) => {
              next.set(
                matrixUserId,
                await readMemberPresence(client, matrixUserId),
              );
            }),
          );
          if (cancelled) return;
          setMatrixPresenceById((current) =>
            current && samePresenceMap(current, next) ? current : next,
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
  }, [matrix.client, matrix.isAuthenticated, matrixUserIds]);

  const value = useMemo<PresenceRegistryValue>(
    () => ({
      getByPersonId: (personId) =>
        personPresenceById.get(personId) ?? 'offline',
      getByMatrixUserId: (matrixUserId) =>
        matrixPresenceById?.get(matrixUserId.trim()) ?? 'offline',
      registerPersonId,
      unregisterPersonId,
      registerMatrixUserId,
      unregisterMatrixUserId,
    }),
    [
      matrixPresenceById,
      personPresenceById,
      registerMatrixUserId,
      registerPersonId,
      unregisterMatrixUserId,
      unregisterPersonId,
    ],
  );

  return (
    <PresenceRegistryContext.Provider value={value}>
      {children}
    </PresenceRegistryContext.Provider>
  );
}

/** Subscribe a portrait to the shared presence registry (no-op outside provider). */
export function useRegisteredPresence({
  personId,
  matrixUserId,
}: {
  personId?: number;
  matrixUserId?: string;
}): PresenceLevel | null {
  const ctx = useContext(PresenceRegistryContext);
  const normalizedMatrixId = matrixUserId?.trim() || undefined;

  useEffect(() => {
    if (!ctx) return;
    if (personId != null && personId > 0) {
      ctx.registerPersonId(personId);
      return () => ctx.unregisterPersonId(personId);
    }
    return;
  }, [ctx, personId]);

  useEffect(() => {
    if (!ctx || !normalizedMatrixId) return;
    // Prefer personId mapping when both are present — avoid double polling.
    if (personId != null && personId > 0) return;
    ctx.registerMatrixUserId(normalizedMatrixId);
    return () => ctx.unregisterMatrixUserId(normalizedMatrixId);
  }, [ctx, normalizedMatrixId, personId]);

  if (!ctx) return null;
  if (personId != null && personId > 0) return ctx.getByPersonId(personId);
  if (normalizedMatrixId) return ctx.getByMatrixUserId(normalizedMatrixId);
  return null;
}
