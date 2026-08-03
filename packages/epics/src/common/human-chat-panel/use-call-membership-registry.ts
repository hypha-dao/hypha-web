'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type * as MatrixSdk from 'matrix-js-sdk';
import { ClientEvent } from 'matrix-js-sdk';
import {
  useMatrix,
  MATRIX_RTC_SESSION_EVENT,
  type MatrixRtcSessionLike,
} from '@hypha-platform/core/client';
import { resolveSignalThreadByMatrixRoom } from './resolve-signal-thread-by-matrix-room';
import { resolveSpaceByMatrixRoom } from './resolve-space-by-matrix-room';

/**
 * Not part of the public matrix-js-sdk types — same cast `use-space-group-call.ts` uses
 * to reach the MatrixRTC extension attached to the client at `createClient()` time.
 */
type MatrixClientWithMatrixRtc = MatrixSdk.MatrixClient & {
  matrixRTC: {
    getRoomSession: (room: MatrixSdk.Room) => MatrixRtcSessionLike;
  };
};

function getRoomRtcSession(
  client: MatrixSdk.MatrixClient,
  room: MatrixSdk.Room,
): MatrixRtcSessionLike | null {
  try {
    return (client as MatrixClientWithMatrixRtc).matrixRTC.getRoomSession(room);
  } catch {
    return null;
  }
}

function roomHasActiveCall(
  client: MatrixSdk.MatrixClient,
  room: MatrixSdk.Room,
): boolean {
  const session = getRoomRtcSession(client, room);
  if (!session) return false;
  return session.memberships.some((membership) => !membership.isExpired());
}

export type CallElsewhereEntry = {
  roomId: string;
  kind: 'space' | 'signal';
  spaceSlug: string;
  signalSlug?: string;
  /** Space or signal title, for display (avatar tooltip / menu label). */
  title: string;
};

export type UseCallMembershipRegistryParams = {
  /** Exclude this room from the output — typically the user's own currently-bound call room. */
  excludeRoomId?: string | null;
  getAccessToken?: () => Promise<string | null | undefined>;
};

/**
 * Tracks which rooms the user is joined to have an active MatrixRTC call, excluding
 * whichever room they're already in. Reads state already flowing through the app's
 * existing full-account Matrix `/sync` (see #2424 decisions.md #1, #11) — no new
 * subscriptions or server queries for scoping; room-set scoping is just "rooms I'm
 * joined to" (`client.getRooms()`), which the client already knows.
 */
export function useCallMembershipRegistry({
  excludeRoomId,
  getAccessToken,
}: UseCallMembershipRegistryParams): CallElsewhereEntry[] {
  const { client } = useMatrix();
  const [activeRoomIds, setActiveRoomIds] = useState<string[]>([]);
  const [entries, setEntries] = useState<CallElsewhereEntry[]>([]);
  const identityCacheRef = useRef<Map<string, CallElsewhereEntry>>(new Map());
  /**
   * Callers pass an inline `getAccessToken` (a new function every render). Reading it via a
   * ref — rather than depending on it directly — keeps `resolveIdentity` referentially stable,
   * so the identity-resolution effect below doesn't re-run (and re-`setEntries` a brand-new
   * array) on every render, which was causing a render loop ("Maximum update depth exceeded").
   */
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  useEffect(() => {
    if (!client) {
      setActiveRoomIds([]);
      return;
    }

    const sessionListeners = new Map<string, MatrixRtcSessionLike>();

    const recomputeActiveRoomIds = () => {
      const joinedRooms = client
        .getRooms()
        .filter((room) => room.getMyMembership() === 'join');
      const active = joinedRooms
        .filter((room) => roomHasActiveCall(client, room))
        .map((room) => room.roomId);
      setActiveRoomIds((prev) => {
        if (
          prev.length === active.length &&
          prev.every((id, index) => id === active[index])
        ) {
          return prev;
        }
        return active;
      });
    };

    const attachSessionListeners = () => {
      const joinedRooms = client
        .getRooms()
        .filter((room) => room.getMyMembership() === 'join');
      for (const room of joinedRooms) {
        if (sessionListeners.has(room.roomId)) continue;
        const session = getRoomRtcSession(client, room);
        if (!session) continue;
        session.on(
          MATRIX_RTC_SESSION_EVENT.MembershipsChanged,
          recomputeActiveRoomIds,
        );
        sessionListeners.set(room.roomId, session);
      }
    };

    attachSessionListeners();
    recomputeActiveRoomIds();

    /** New rooms can appear after initial sync (space joined, signal opened for the first time). */
    const onRoom = () => {
      attachSessionListeners();
      recomputeActiveRoomIds();
    };
    client.on(ClientEvent.Room, onRoom);
    client.on(ClientEvent.Sync, recomputeActiveRoomIds);

    return () => {
      client.removeListener(ClientEvent.Room, onRoom);
      client.removeListener(ClientEvent.Sync, recomputeActiveRoomIds);
      for (const session of sessionListeners.values()) {
        session.off(
          MATRIX_RTC_SESSION_EVENT.MembershipsChanged,
          recomputeActiveRoomIds,
        );
      }
    };
  }, [client]);

  const resolveIdentity = useCallback(
    async (roomId: string): Promise<CallElsewhereEntry | null> => {
      const cached = identityCacheRef.current.get(roomId);
      if (cached) return cached;

      const signal = await resolveSignalThreadByMatrixRoom(roomId, async () =>
        getAccessTokenRef.current?.(),
      );
      if (signal) {
        const entry: CallElsewhereEntry = {
          roomId,
          kind: 'signal',
          spaceSlug: signal.spaceSlug,
          signalSlug: signal.signalSlug,
          title: signal.signalTitle,
        };
        identityCacheRef.current.set(roomId, entry);
        return entry;
      }

      const space = await resolveSpaceByMatrixRoom(roomId, async () =>
        getAccessTokenRef.current?.(),
      );
      if (space) {
        const entry: CallElsewhereEntry = {
          roomId,
          kind: 'space',
          spaceSlug: space.spaceSlug,
          title: space.spaceTitle,
        };
        identityCacheRef.current.set(roomId, entry);
        return entry;
      }

      return null;
    },
    [],
  );

  useEffect(() => {
    const targetRoomIds = activeRoomIds.filter((id) => id !== excludeRoomId);
    if (targetRoomIds.length === 0) {
      setEntries([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      const resolved = await Promise.all(
        targetRoomIds.map((roomId) => resolveIdentity(roomId)),
      );
      if (cancelled) return;
      const next = resolved.filter(
        (entry): entry is CallElsewhereEntry => entry !== null,
      );
      setEntries((prev) => {
        if (
          prev.length === next.length &&
          prev.every((entry, index) => entry.roomId === next[index]?.roomId)
        ) {
          return prev;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [activeRoomIds, excludeRoomId, resolveIdentity]);

  return entries;
}
