'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClientEvent,
  EventType,
  RoomMemberEvent,
  type MatrixClient,
  type MatrixEvent,
  type RoomMember,
} from 'matrix-js-sdk';
import {
  looksLikeTechnicalMatrixDisplayName,
  visibleMatrixMemberName,
} from './matrix-room-member-display';

const TYPING_TIMEOUT_MS = 30_000;
/** Re-assert typing before the server expires it. */
const TYPING_REFRESH_MS = 20_000;
/** Stop advertising typing after idle even if composer text remains. */
const TYPING_IDLE_MS = 5_000;

export type ChatTypingPeer = {
  userId: string;
  name: string;
};

function isUnresolvedTypingLabel(
  label: string | undefined | null,
  unknownMemberLabel: string,
): boolean {
  const trimmed = label?.trim() ?? '';
  if (!trimmed) return true;
  const unknown = unknownMemberLabel.trim();
  if (!unknown) return false;
  return (
    trimmed.localeCompare(unknown, undefined, { sensitivity: 'accent' }) === 0
  );
}

/**
 * Prefer Hypha/app resolveName, but never treat the Unknown fallback as final
 * when Matrix still has a visible member name (or a later roster resolve).
 */
export function resolveTypingPeerName(
  userId: string,
  resolveName: (userId: string) => string,
  unknownMemberLabel: string,
  member?: RoomMember | null,
): string {
  const resolved = resolveName(userId)?.trim() ?? '';
  if (!isUnresolvedTypingLabel(resolved, unknownMemberLabel)) {
    return resolved;
  }

  const memberName = member?.name?.trim() || member?.rawDisplayName?.trim();
  if (memberName && !looksLikeTechnicalMatrixDisplayName(memberName, userId)) {
    return memberName;
  }

  const visible = visibleMatrixMemberName(userId, memberName).trim();
  if (visible) return visible;

  return unknownMemberLabel.trim() || resolved;
}

export function typingPeersFromUserIds(
  client: MatrixClient,
  roomId: string,
  userIds: readonly string[],
  resolveName: (userId: string) => string,
  unknownMemberLabel: string,
): ChatTypingPeer[] {
  const selfId = client.getUserId()?.trim() ?? '';
  const room = client.getRoom(roomId);
  const peers: ChatTypingPeer[] = [];
  for (const rawId of userIds) {
    const userId = rawId?.trim();
    if (!userId || userId === selfId) continue;
    const member = room?.getMember(userId);
    peers.push({
      userId,
      name: resolveTypingPeerName(
        userId,
        resolveName,
        unknownMemberLabel,
        member,
      ),
    });
  }
  peers.sort((a, b) => a.name.localeCompare(b.name));
  return peers;
}

function typingPeersFromRoom(
  client: MatrixClient,
  roomId: string,
  resolveName: (userId: string) => string,
  unknownMemberLabel: string,
): ChatTypingPeer[] {
  const selfId = client.getUserId()?.trim() ?? '';
  const room = client.getRoom(roomId);
  if (!room) return [];
  const peers: ChatTypingPeer[] = [];
  for (const member of room.getJoinedMembers()) {
    if (!member.typing) continue;
    const userId = member.userId?.trim();
    if (!userId || userId === selfId) continue;
    peers.push({
      userId,
      name: resolveTypingPeerName(
        userId,
        resolveName,
        unknownMemberLabel,
        member,
      ),
    });
  }
  peers.sort((a, b) => a.name.localeCompare(b.name));
  return peers;
}

function typingUserIdsFromEvent(event: MatrixEvent): string[] | null {
  if (event.getType() !== EventType.Typing && event.getType() !== 'm.typing') {
    return null;
  }
  const userIds = event.getContent()?.user_ids;
  return Array.isArray(userIds)
    ? userIds.filter((id): id is string => typeof id === 'string')
    : [];
}

/**
 * Send Matrix typing while the local composer has text, and list who else is
 * typing in the open room.
 */
export function useChatRoomTyping({
  client,
  roomId,
  resolveName,
  unknownMemberLabel,
}: {
  client: MatrixClient | null;
  roomId: string | null;
  resolveName: (userId: string) => string;
  /** i18n "Unknown" — treated as unresolved so Matrix/roster can still win. */
  unknownMemberLabel: string;
}): {
  typingPeers: ChatTypingPeer[];
  setComposerTyping: (isTyping: boolean) => void;
} {
  const [typingPeers, setTypingPeers] = useState<ChatTypingPeer[]>([]);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const resolveNameRef = useRef(resolveName);
  resolveNameRef.current = resolveName;
  const unknownMemberLabelRef = useRef(unknownMemberLabel);
  unknownMemberLabelRef.current = unknownMemberLabel;
  const localTypingRef = useRef(false);
  const refreshTimerRef = useRef(0);
  const idleTimerRef = useRef(0);

  const refreshPeers = useCallback(() => {
    if (!client || !roomIdRef.current) {
      setTypingPeers([]);
      return;
    }
    setTypingPeers(
      typingPeersFromRoom(
        client,
        roomIdRef.current,
        resolveNameRef.current,
        unknownMemberLabelRef.current,
      ),
    );
  }, [client]);

  const applyTypingUserIds = useCallback(
    (userIds: readonly string[]) => {
      if (!client || !roomIdRef.current) {
        setTypingPeers([]);
        return;
      }
      setTypingPeers(
        typingPeersFromUserIds(
          client,
          roomIdRef.current,
          userIds,
          resolveNameRef.current,
          unknownMemberLabelRef.current,
        ),
      );
    },
    [client],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!client || !roomIdRef.current) return;
      const id = roomIdRef.current;
      void client.sendTyping(id, isTyping, TYPING_TIMEOUT_MS).catch(() => {
        // Ephemeral — never block the composer.
      });
    },
    [client],
  );

  const clearRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = 0;
    }
  }, []);

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = 0;
    }
  }, []);

  const setComposerTyping = useCallback(
    (isTyping: boolean) => {
      if (!client || !roomIdRef.current) return;

      if (isTyping) {
        clearIdle();
        idleTimerRef.current = window.setTimeout(() => {
          if (!localTypingRef.current) return;
          localTypingRef.current = false;
          clearRefresh();
          sendTyping(false);
        }, TYPING_IDLE_MS);
      } else {
        clearIdle();
      }

      // Only PUT on state changes + refresh timer — not every keystroke
      // (homeservers rate-limit /typing and drop notifications).
      if (isTyping === localTypingRef.current) {
        return;
      }
      localTypingRef.current = isTyping;
      clearRefresh();
      sendTyping(isTyping);
      if (isTyping) {
        refreshTimerRef.current = window.setInterval(() => {
          if (!localTypingRef.current) return;
          sendTyping(true);
        }, TYPING_REFRESH_MS);
      }
    },
    [clearIdle, clearRefresh, client, sendTyping],
  );

  // Listen for others typing in the open room.
  useEffect(() => {
    if (!client || !roomId) {
      setTypingPeers([]);
      return;
    }
    refreshPeers();

    const onMemberTyping = (_event: MatrixEvent, member: RoomMember) => {
      if (member.roomId !== roomId) return;
      refreshPeers();
    };

    // Sync emits ClientEvent.Event for ephemeral m.typing after members update.
    // Prefer user_ids from the event when room_id matches; otherwise refresh
    // member.typing (ephemeral events often omit room_id in the payload).
    const onClientEvent = (event: MatrixEvent) => {
      const userIds = typingUserIdsFromEvent(event);
      if (userIds == null) return;
      const eventRoomId = event.getRoomId();
      if (eventRoomId && eventRoomId !== roomId) return;
      if (eventRoomId === roomId) {
        applyTypingUserIds(userIds);
        return;
      }
      refreshPeers();
    };

    client.on(RoomMemberEvent.Typing, onMemberTyping);
    client.on(ClientEvent.Event, onClientEvent);
    return () => {
      client.removeListener(RoomMemberEvent.Typing, onMemberTyping);
      client.removeListener(ClientEvent.Event, onClientEvent);
    };
  }, [applyTypingUserIds, client, roomId, refreshPeers]);

  // When roster/profile maps catch up, re-label whoever is already typing.
  useEffect(() => {
    if (!client || !roomId) return;
    refreshPeers();
  }, [client, refreshPeers, resolveName, roomId, unknownMemberLabel]);

  // Stop typing when leaving the room / unmounting.
  useEffect(() => {
    return () => {
      clearIdle();
      clearRefresh();
      if (localTypingRef.current && client && roomId) {
        localTypingRef.current = false;
        void client.sendTyping(roomId, false, 0).catch(() => {});
      }
    };
  }, [clearIdle, clearRefresh, client, roomId]);

  return { typingPeers, setComposerTyping };
}
