'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RoomMemberEvent,
  type MatrixClient,
  type MatrixEvent,
  type RoomMember,
} from 'matrix-js-sdk';

const TYPING_TIMEOUT_MS = 30_000;
/** Re-assert typing before the server expires it. */
const TYPING_REFRESH_MS = 20_000;

export type ChatTypingPeer = {
  userId: string;
  name: string;
};

function typingPeersFromRoom(
  client: MatrixClient,
  roomId: string,
  resolveName: (userId: string) => string,
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
      name: resolveName(userId) || member.name || userId,
    });
  }
  peers.sort((a, b) => a.name.localeCompare(b.name));
  return peers;
}

/**
 * Send Matrix typing while the local composer has text, and list who else is
 * typing in the open room.
 */
export function useChatRoomTyping({
  client,
  roomId,
  resolveName,
}: {
  client: MatrixClient | null;
  roomId: string | null;
  resolveName: (userId: string) => string;
}): {
  typingPeers: ChatTypingPeer[];
  setComposerTyping: (isTyping: boolean) => void;
} {
  const [typingPeers, setTypingPeers] = useState<ChatTypingPeer[]>([]);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const resolveNameRef = useRef(resolveName);
  resolveNameRef.current = resolveName;
  const localTypingRef = useRef(false);
  const refreshTimerRef = useRef(0);

  const refreshPeers = useCallback(() => {
    if (!client || !roomIdRef.current) {
      setTypingPeers([]);
      return;
    }
    setTypingPeers(
      typingPeersFromRoom(client, roomIdRef.current, resolveNameRef.current),
    );
  }, [client]);

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

  const setComposerTyping = useCallback(
    (isTyping: boolean) => {
      if (!client || !roomIdRef.current) return;
      if (isTyping === localTypingRef.current) {
        if (isTyping) sendTyping(true);
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
    [clearRefresh, client, sendTyping],
  );

  // Listen for others typing in the open room.
  useEffect(() => {
    if (!client || !roomId) {
      setTypingPeers([]);
      return;
    }
    refreshPeers();
    const onTyping = (_event: MatrixEvent, member: RoomMember) => {
      if (member.roomId !== roomId) return;
      refreshPeers();
    };
    client.on(RoomMemberEvent.Typing, onTyping);
    return () => {
      client.removeListener(RoomMemberEvent.Typing, onTyping);
    };
  }, [client, roomId, refreshPeers]);

  // Stop typing when leaving the room / unmounting.
  useEffect(() => {
    return () => {
      clearRefresh();
      if (localTypingRef.current && client && roomId) {
        localTypingRef.current = false;
        void client.sendTyping(roomId, false, 0).catch(() => {});
      }
    };
  }, [clearRefresh, client, roomId]);

  return { typingPeers, setComposerTyping };
}
