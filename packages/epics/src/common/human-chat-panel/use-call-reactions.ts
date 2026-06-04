'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { RoomEvent } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import {
  aggregateCallRaisedHands,
  CALL_FLOATING_REACTION_MAX_PER_TILE,
  CALL_FLOATING_REACTION_MS,
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
  callState: SpaceGroupCallState;
  currentUserId: string | null;
};

export function useCallReactions({
  client,
  roomId,
  anchorEventId,
  callState,
  currentUserId,
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

  const canSendCallReactions =
    callState === 'connected' &&
    Boolean(client && roomId?.trim() && anchorEventId?.trim());

  const seedRaisedHands = useCallback(() => {
    if (!client || !roomId?.trim()) {
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
    const aggregated = aggregateCallRaisedHands(events);
    setRaisedHands(aggregated);
    setLocalHandRaised(
      Boolean(
        currentUserId &&
          aggregated.some((entry) => entry.userId === currentUserId),
      ),
    );
  }, [client, currentUserId, roomId]);

  useEffect(() => {
    seedRaisedHands();
  }, [seedRaisedHands, anchorEventId]);

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
      if (raiseHand) {
        setRaisedHands((prev) => {
          const withoutUser = prev.filter(
            (entry) => entry.userId !== raiseHand.userId,
          );
          if (!raiseHand.raised) {
            if (raiseHand.userId === currentUserId) {
              setLocalHandRaised(false);
            }
            return withoutUser;
          }
          const next = [
            ...withoutUser,
            { userId: raiseHand.userId, raisedAt: raiseHand.raisedAt },
          ].sort((a, b) => a.raisedAt - b.raisedAt);
          if (raiseHand.userId === currentUserId) {
            setLocalHandRaised(true);
          }
          return next;
        });
      }
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
  }, [anchorEventId, client, currentUserId, roomId]);

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
    if (!canSendCallReactions || !client || !roomId?.trim()) return;
    const nextRaised = !localHandRaised;
    setLocalHandRaised(nextRaised);
    try {
      await sendCallRaiseHandNotice({
        client,
        roomId: roomId.trim(),
        raised: nextRaised,
      });
    } catch {
      setLocalHandRaised(!nextRaised);
    }
  }, [canSendCallReactions, client, localHandRaised, roomId]);

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
      return raisedHands.some((entry) => entry.userId === userId);
    },
    [raisedHands],
  );

  return {
    canSendCallReactions,
    raisedHands,
    localHandRaised,
    sendReaction,
    toggleRaiseHand,
    getFloatingReactions,
    isHandRaised,
    floatingReactionsVersion,
  };
}
