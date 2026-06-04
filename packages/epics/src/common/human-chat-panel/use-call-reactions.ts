'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { RoomEvent } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import {
  aggregateCallRaisedHands,
  callReactionsApplyToPinnedSpace,
  CALL_FLOATING_REACTION_MAX_PER_TILE,
  CALL_FLOATING_REACTION_MS,
  filterCallRaisedHandsToInCallParticipants,
  parseCallRaiseHandNotice,
  parseCallReactionAnnotation,
  sendCallRaiseHandNotice,
  sendCallReactionAnnotation,
  type CallRaisedHandEntry,
  type SpaceGroupCallState,
} from '@hypha-platform/core/client';
import type { CallFloatingReactionStyle } from './call-zoom-reaction-catalog';

export type CallFloatingReaction = {
  id: string;
  emoji: string;
  userId: string;
  style?: CallFloatingReactionStyle;
};

export type UseCallReactionsOptions = {
  client: MatrixClient | null;
  roomId: string | null;
  anchorEventId: string | null;
  groupCallId: string | null;
  callState: SpaceGroupCallState;
  currentUserId: string | null;
  /** Matrix user ids with a device in the active group call — filters stale raise-hand timeline entries. */
  inCallUserIds?: string[] | null;
  /** Space slug for the active call session (pinned while in call). */
  pinnedCallSpaceSlug?: string | null;
  /** Space slug for the UI the user is currently viewing. */
  boundSpaceSlug?: string | null;
};

export function useCallReactions({
  client,
  roomId,
  anchorEventId,
  groupCallId,
  callState,
  currentUserId,
  inCallUserIds = null,
  pinnedCallSpaceSlug = null,
  boundSpaceSlug = null,
}: UseCallReactionsOptions) {
  const [raisedHands, setRaisedHands] = useState<CallRaisedHandEntry[]>([]);
  const [localHandRaised, setLocalHandRaised] = useState(false);
  const floatingByUserRef = useRef<Map<string, CallFloatingReaction[]>>(
    new Map(),
  );
  const floatingTimersRef = useRef<Map<string, number>>(new Map());
  const [floatingReactionsVersion, bumpFloatingReactions] = useReducer(
    (value: number) => value + 1,
    0,
  );
  const pushFloatingReactionRef = useRef<
    (userId: string, emoji: string, style?: CallFloatingReactionStyle) => void
  >(() => {});

  const stableGroupCallId = groupCallId?.trim() || null;
  const reactionsApplyToPinnedSpace = callReactionsApplyToPinnedSpace(
    pinnedCallSpaceSlug,
    boundSpaceSlug,
  );

  const callReactionsSessionActive =
    callState === 'connected' &&
    Boolean(client && roomId?.trim() && stableGroupCallId);

  const canSendCallReactions =
    callReactionsSessionActive &&
    reactionsApplyToPinnedSpace &&
    Boolean(anchorEventId?.trim());

  const applyInCallFilter = useCallback(
    (entries: CallRaisedHandEntry[]) =>
      filterCallRaisedHandsToInCallParticipants(entries, inCallUserIds),
    [inCallUserIds],
  );

  const seedRaisedHands = useCallback(() => {
    if (!client || !roomId?.trim() || !stableGroupCallId) {
      setRaisedHands([]);
      setLocalHandRaised(false);
      return;
    }
    const room = client.getRoom(roomId.trim());
    if (!room) {
      setRaisedHands([]);
      setLocalHandRaised(false);
      return;
    }
    const events = room.getLiveTimeline()?.getEvents() ?? [];
    const aggregated = applyInCallFilter(
      aggregateCallRaisedHands(events, stableGroupCallId),
    );
    setRaisedHands(aggregated);
    setLocalHandRaised(
      Boolean(
        currentUserId &&
          aggregated.some((entry) => entry.userId === currentUserId),
      ),
    );
  }, [applyInCallFilter, client, currentUserId, roomId, stableGroupCallId]);

  useEffect(() => {
    seedRaisedHands();
  }, [seedRaisedHands, anchorEventId]);

  useEffect(() => {
    setRaisedHands((prev) => applyInCallFilter(prev));
  }, [applyInCallFilter]);

  useEffect(() => {
    if (callState === 'idle') {
      setRaisedHands([]);
      setLocalHandRaised(false);
    }
  }, [callState]);

  useEffect(() => {
    if (
      reactionsApplyToPinnedSpace ||
      !localHandRaised ||
      !callReactionsSessionActive ||
      !client ||
      !roomId?.trim() ||
      !stableGroupCallId
    ) {
      return;
    }
    setLocalHandRaised(false);
    setRaisedHands((prev) =>
      currentUserId
        ? prev.filter((entry) => entry.userId !== currentUserId)
        : prev,
    );
    void sendCallRaiseHandNotice({
      client,
      roomId: roomId.trim(),
      groupCallId: stableGroupCallId,
      raised: false,
    }).catch(() => {});
  }, [
    callReactionsSessionActive,
    client,
    currentUserId,
    localHandRaised,
    reactionsApplyToPinnedSpace,
    roomId,
    stableGroupCallId,
  ]);

  useEffect(() => {
    if (!client || !roomId?.trim() || !anchorEventId?.trim()) return;
    const stableRoomId = roomId.trim();
    const stableAnchorId = anchorEventId.trim();

    const pushFloatingReaction = (
      userId: string,
      emoji: string,
      style: CallFloatingReactionStyle = 'default',
    ) => {
      const id = `${userId}:${Date.now()}:${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const nextEntry: CallFloatingReaction = { id, emoji, userId, style };
      const prev = floatingByUserRef.current.get(userId) ?? [];
      const next = [...prev, nextEntry].slice(
        -CALL_FLOATING_REACTION_MAX_PER_TILE,
      );
      floatingByUserRef.current.set(userId, next);
      bumpFloatingReactions();
      const timerKey = id;
      const timer = window.setTimeout(() => {
        floatingTimersRef.current.delete(timerKey);
        const current = floatingByUserRef.current.get(userId) ?? [];
        floatingByUserRef.current.set(
          userId,
          current.filter((item) => item.id !== id),
        );
        bumpFloatingReactions();
      }, CALL_FLOATING_REACTION_MS);
      floatingTimersRef.current.set(timerKey, timer);
    };

    pushFloatingReactionRef.current = pushFloatingReaction;

    const onTimeline = (event: MatrixEvent, room: Room | undefined) => {
      if (room?.roomId !== stableRoomId) return;
      const reaction = parseCallReactionAnnotation(event, stableAnchorId);
      if (reaction) {
        if (reaction.userId !== currentUserId) {
          pushFloatingReaction(reaction.userId, reaction.key);
        }
        return;
      }
      const raiseHand = parseCallRaiseHandNotice(event);
      if (!raiseHand || !stableGroupCallId) return;
      if (raiseHand.groupCallId !== stableGroupCallId) return;
      setRaisedHands((prev) => {
        const withoutUser = prev.filter(
          (entry) => entry.userId !== raiseHand.userId,
        );
        if (!raiseHand.raised) {
          if (raiseHand.userId === currentUserId) {
            setLocalHandRaised(false);
          }
          return applyInCallFilter(withoutUser);
        }
        const next = applyInCallFilter(
          [
            ...withoutUser,
            { userId: raiseHand.userId, raisedAt: raiseHand.raisedAt },
          ].sort((a, b) => a.raisedAt - b.raisedAt),
        );
        if (raiseHand.userId === currentUserId) {
          setLocalHandRaised(true);
        }
        return next;
      });
    };

    client.on(RoomEvent.Timeline, onTimeline);
    return () => {
      client.removeListener(RoomEvent.Timeline, onTimeline);
      for (const timer of floatingTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      floatingTimersRef.current.clear();
      floatingByUserRef.current.clear();
      pushFloatingReactionRef.current = () => {};
      bumpFloatingReactions();
    };
  }, [
    anchorEventId,
    applyInCallFilter,
    client,
    currentUserId,
    roomId,
    stableGroupCallId,
  ]);

  const sendReaction = useCallback(
    async (emoji: string, style: CallFloatingReactionStyle = 'default') => {
      if (
        !canSendCallReactions ||
        !client ||
        !roomId?.trim() ||
        !anchorEventId
      ) {
        return;
      }
      if (currentUserId) {
        pushFloatingReactionRef.current(currentUserId, emoji, style);
      }
      await sendCallReactionAnnotation({
        client,
        roomId: roomId.trim(),
        anchorEventId: anchorEventId.trim(),
        key: emoji,
      });
    },
    [anchorEventId, canSendCallReactions, client, currentUserId, roomId],
  );

  const toggleRaiseHand = useCallback(async () => {
    if (
      !callReactionsSessionActive ||
      !reactionsApplyToPinnedSpace ||
      !client ||
      !roomId?.trim() ||
      !stableGroupCallId
    ) {
      return;
    }
    const nextRaised = !localHandRaised;
    setLocalHandRaised(nextRaised);
    try {
      await sendCallRaiseHandNotice({
        client,
        roomId: roomId.trim(),
        groupCallId: stableGroupCallId,
        raised: nextRaised,
      });
    } catch {
      setLocalHandRaised(!nextRaised);
    }
  }, [
    callReactionsSessionActive,
    client,
    localHandRaised,
    reactionsApplyToPinnedSpace,
    roomId,
    stableGroupCallId,
  ]);

  const visibleRaisedHands = reactionsApplyToPinnedSpace ? raisedHands : [];
  const visibleLocalHandRaised = reactionsApplyToPinnedSpace && localHandRaised;

  const getFloatingReactions = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return [];
      return floatingByUserRef.current.get(userId) ?? [];
    },
    [floatingReactionsVersion],
  );

  const isHandRaised = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return false;
      return visibleRaisedHands.some((entry) => entry.userId === userId);
    },
    [visibleRaisedHands],
  );

  const getRaiseHandOrder = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return null;
      const index = visibleRaisedHands.findIndex(
        (entry) => entry.userId === userId,
      );
      return index >= 0 ? index + 1 : null;
    },
    [visibleRaisedHands],
  );

  return {
    canSendCallReactions,
    raisedHands: visibleRaisedHands,
    localHandRaised: visibleLocalHandRaised,
    sendReaction,
    toggleRaiseHand,
    getFloatingReactions,
    isHandRaised,
    getRaiseHandOrder,
    floatingReactionsVersion,
  };
}
