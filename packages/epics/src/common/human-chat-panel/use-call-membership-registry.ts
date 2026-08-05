'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type * as MatrixSdk from 'matrix-js-sdk';
import { ClientEvent } from 'matrix-js-sdk';
import {
  useMatrix,
  MATRIX_RTC_SESSION_EVENT,
  isMatrixCallDebugEnabled,
  type MatrixRtcSessionLike,
} from '@hypha-platform/core/client';
import { resolveSignalThreadByMatrixRoom } from './resolve-signal-thread-by-matrix-room';
import { resolveSpaceByMatrixRoom } from './resolve-space-by-matrix-room';

/** Same convention as `use-space-group-call.ts`'s `logCallDebug` — gated by `hypha.callDebug`. */
function logRegistryDebug(step: string, extra?: Record<string, unknown>) {
  if (!isMatrixCallDebugEnabled()) return;
  console.info('[hypha.call_membership_registry.debug] ' + step, extra);
}

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

/** Non-expired MatrixRTC memberships for a room — 0 means no active call. */
function getRoomActiveCallParticipantCount(
  client: MatrixSdk.MatrixClient,
  room: MatrixSdk.Room,
): number {
  const session = getRoomRtcSession(client, room);
  if (!session) {
    logRegistryDebug('room-has-active-call:no-session', {
      roomId: room.roomId,
    });
    return 0;
  }
  const active = session.memberships.filter(
    (membership) => !membership.isExpired(),
  );
  logRegistryDebug('room-has-active-call:checked', {
    roomId: room.roomId,
    totalMemberships: session.memberships.length,
    activeMemberships: active.length,
    senders: session.memberships.map((m) => ({
      sender: m.sender,
      expired: m.isExpired(),
    })),
  });
  return active.length;
}

/** Identity fields only — safe to cache indefinitely (immutable per room), unlike
 * `participantCount` below which changes as people join/leave the call. */
type CallIdentity = {
  roomId: string;
  kind: 'space' | 'signal';
  spaceSlug: string;
  signalSlug?: string;
  /** Space or signal title, for display (avatar tooltip / menu label). */
  title: string;
};

export type CallElsewhereEntry = CallIdentity & {
  /** Live count, refreshed whenever the active-room set is recomputed — not part of the
   * cached identity, so a stale count is never served from `sharedIdentityCache`. */
  participantCount: number;
};

export type UseCallMembershipRegistryParams = {
  /**
   * Exclude these rooms from the output. Callers combine whichever apply: the room
   * currently being viewed, and/or the user's own actively-bound call room — these can
   * differ (e.g. browsing space Z's chat while still on a call bound to space Y), and both
   * need excluding so the badge never points at a room the user is already in a call in.
   */
  excludeRoomIds?: Array<string | null | undefined>;
  getAccessToken?: () => Promise<string | null | undefined>;
};

/**
 * Tracks which rooms the user is joined to have an active MatrixRTC call, excluding
 * whichever room they're already in. Reads state already flowing through the app's
 * existing full-account Matrix `/sync` (see #2424 decisions.md #1, #11) — no new
 * subscriptions or server queries for scoping; room-set scoping is just "rooms I'm
 * joined to" (`client.getRooms()`), which the client already knows.
 */
/**
 * Module-scope (not per-instance `useRef`) so every mount of this hook shares one cache —
 * e.g. the always-mounted top-nav trigger and the right panel's own instance, which remounts
 * whenever `PanelWrapLayout` switches JSX branches (space vs. non-space navigation changes
 * which sidebar layout renders). Without sharing, a fresh mount re-resolves identities its
 * sibling instance already has, showing up as a visible delay before the avatar appears.
 * Lives for the page session only — reset on full reload, never persisted.
 */
const sharedIdentityCache = new Map<string, CallIdentity>();

/**
 * Rooms that resolved to neither a signal nor a space, so `resolveIdentity` isn't hammered
 * with two requests on every sync event for a room that will never resolve (e.g. a call in a
 * DM room). `hadToken` records whether the lookup ran with a bearer token: if it didn't (the
 * caller's `getAccessToken` hadn't resolved yet), the entry doesn't block a retry once a token
 * becomes available — only a token-backed non-match is treated as durable.
 */
const sharedUnresolvedRoomIds = new Map<string, { hadToken: boolean }>();

export function useCallMembershipRegistry({
  excludeRoomIds,
  getAccessToken,
}: UseCallMembershipRegistryParams): CallElsewhereEntry[] {
  const { client } = useMatrix();
  const [activeRoomIds, setActiveRoomIds] = useState<string[]>([]);
  const [entries, setEntries] = useState<CallElsewhereEntry[]>([]);
  const identityCacheRef =
    useRef<Map<string, CallIdentity>>(sharedIdentityCache);
  /** Not cached, unlike identity — refreshed on every recompute. Per-instance, since it's
   * cheap to recompute and (unlike identity) must never go stale across mounts. */
  const roomParticipantCountsRef = useRef<Map<string, number>>(new Map());
  /**
   * Callers pass a fresh array literal every render (e.g. `[roomId, activeRoomId]`) — read
   * via a ref (same pattern as `getAccessTokenRef` below) so the identity-resolution effect
   * depends on a stable derived string key instead of the array's identity.
   */
  const excludeRoomIdsRef = useRef<Array<string | null | undefined>>(
    excludeRoomIds ?? [],
  );
  excludeRoomIdsRef.current = excludeRoomIds ?? [];
  const excludeRoomIdsKey = (excludeRoomIds ?? [])
    .filter((id): id is string => Boolean(id))
    .sort()
    .join(',');
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

    const sessionListeners = new Map<
      string,
      { session: MatrixRtcSessionLike; listener: () => void }
    >();

    const recomputeActiveRoomIds = (source = 'unknown') => {
      const joinedRooms = client
        .getRooms()
        .filter((room) => room.getMyMembership() === 'join');
      const nextCounts = new Map<string, number>();
      const active: string[] = [];
      for (const room of joinedRooms) {
        const count = getRoomActiveCallParticipantCount(client, room);
        if (count > 0) {
          nextCounts.set(room.roomId, count);
          active.push(room.roomId);
        }
      }
      roomParticipantCountsRef.current = nextCounts;
      logRegistryDebug('recompute-active-room-ids', {
        source,
        joinedRoomCount: joinedRooms.length,
        joinedRoomIds: joinedRooms.map((room) => room.roomId),
        activeRoomIds: active,
      });
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
        const existing = sessionListeners.get(room.roomId);
        if (existing) {
          // If the SDK hands back a *different* session object than the one we're
          // subscribed to, our listener is attached to a now-orphaned instance and will
          // never fire for this room again. Detach it and re-subscribe below instead of
          // just logging, so the room doesn't silently stop reporting call membership.
          const current = getRoomRtcSession(client, room);
          if (current && current !== existing.session) {
            logRegistryDebug('attach-session-listeners:stale-session-object', {
              roomId: room.roomId,
            });
            existing.session.off(
              MATRIX_RTC_SESSION_EVENT.MembershipsChanged,
              existing.listener,
            );
            sessionListeners.delete(room.roomId);
          } else {
            continue;
          }
        }
        const session = getRoomRtcSession(client, room);
        if (!session) {
          logRegistryDebug('attach-session-listeners:no-session', {
            roomId: room.roomId,
          });
          continue;
        }
        const onMembershipsChanged = () =>
          recomputeActiveRoomIds(`session-memberships-changed:${room.roomId}`);
        session.on(
          MATRIX_RTC_SESSION_EVENT.MembershipsChanged,
          onMembershipsChanged,
        );
        sessionListeners.set(room.roomId, {
          session,
          listener: onMembershipsChanged,
        });
        logRegistryDebug('attach-session-listeners:attached', {
          roomId: room.roomId,
        });
      }
    };

    attachSessionListeners();
    recomputeActiveRoomIds('mount');

    /** New rooms can appear after initial sync (space joined, signal opened for the first time). */
    const onRoom = () => {
      attachSessionListeners();
      recomputeActiveRoomIds('client-room-event');
    };
    const onSync = () => recomputeActiveRoomIds('client-sync-event');
    client.on(ClientEvent.Room, onRoom);
    client.on(ClientEvent.Sync, onSync);

    return () => {
      client.removeListener(ClientEvent.Room, onRoom);
      client.removeListener(ClientEvent.Sync, onSync);
      for (const { session, listener } of sessionListeners.values()) {
        session.off(MATRIX_RTC_SESSION_EVENT.MembershipsChanged, listener);
      }
    };
  }, [client]);

  const resolveIdentity = useCallback(
    async (roomId: string): Promise<CallIdentity | null> => {
      const cached = identityCacheRef.current.get(roomId);
      if (cached) return cached;

      const token = (await getAccessTokenRef.current?.()) ?? null;
      const unresolved = sharedUnresolvedRoomIds.get(roomId);
      if (unresolved && (unresolved.hadToken || !token)) {
        return null;
      }

      const signal = await resolveSignalThreadByMatrixRoom(
        roomId,
        async () => token,
      );
      if (signal) {
        const identity: CallIdentity = {
          roomId,
          kind: 'signal',
          spaceSlug: signal.spaceSlug,
          signalSlug: signal.signalSlug,
          title: signal.signalTitle,
        };
        identityCacheRef.current.set(roomId, identity);
        sharedUnresolvedRoomIds.delete(roomId);
        return identity;
      }

      const space = await resolveSpaceByMatrixRoom(roomId, async () => token);
      if (space) {
        const identity: CallIdentity = {
          roomId,
          kind: 'space',
          spaceSlug: space.spaceSlug,
          title: space.spaceTitle,
        };
        identityCacheRef.current.set(roomId, identity);
        sharedUnresolvedRoomIds.delete(roomId);
        return identity;
      }

      sharedUnresolvedRoomIds.set(roomId, { hadToken: Boolean(token) });
      logRegistryDebug('resolve-identity:no-match', {
        roomId,
        hadToken: Boolean(token),
      });
      return null;
    },
    [],
  );

  useEffect(() => {
    const excludeSet = new Set(
      excludeRoomIdsRef.current.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      ),
    );
    const targetRoomIds = activeRoomIds.filter((id) => !excludeSet.has(id));
    logRegistryDebug('identity-resolution-effect', {
      activeRoomIds,
      excludeRoomIds: [...excludeSet],
      targetRoomIds,
    });
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
      const next: CallElsewhereEntry[] = resolved
        .filter((identity): identity is CallIdentity => identity !== null)
        .map((identity) => ({
          ...identity,
          participantCount:
            roomParticipantCountsRef.current.get(identity.roomId) ?? 0,
        }));
      logRegistryDebug('identity-resolution-effect:resolved', {
        targetRoomIds,
        resolvedCount: next.length,
        entries: next,
      });
      setEntries((prev) => {
        if (
          prev.length === next.length &&
          prev.every(
            (entry, index) =>
              entry.roomId === next[index]?.roomId &&
              entry.participantCount === next[index]?.participantCount,
          )
        ) {
          return prev;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [activeRoomIds, excludeRoomIdsKey, resolveIdentity]);

  return entries;
}
