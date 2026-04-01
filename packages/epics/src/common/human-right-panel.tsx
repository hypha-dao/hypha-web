'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from '@hypha-platform/ui';
import { useMatrix, Message } from '@hypha-platform/core/client';

import {
  HumanChatPanelHeader,
  HumanChatPanelMessages,
  HumanChatPanelChatBar,
} from './human-chat-panel';

type UIMessage = {
  id: string;
  role: 'user' | 'member';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
  senderName?: string;
};

const ROOM_STORAGE_KEY = 'hypha-chat-room-';

/**
 * Get a persisted room ID for a space slug from localStorage.
 */
function getStoredRoomId(spaceSlug: string): string | null {
  try {
    return localStorage.getItem(`${ROOM_STORAGE_KEY}${spaceSlug}`);
  } catch {
    return null;
  }
}

function storeRoomId(spaceSlug: string, roomId: string): void {
  try {
    localStorage.setItem(`${ROOM_STORAGE_KEY}${spaceSlug}`, roomId);
  } catch {
    // localStorage not available
  }
}

/**
 * Convert a Matrix Message to the UIMessage format expected by panel components.
 */
function toUIMessage(msg: Message, currentUserId?: string | null): UIMessage {
  const isCurrentUser = currentUserId ? msg.sender === currentUserId : false;
  return {
    id: msg.id,
    role: isCurrentUser ? 'user' : 'member',
    parts: [{ type: 'text', text: msg.content }],
    senderName: isCurrentUser ? undefined : msg.sender,
  };
}

export function HumanRightPanel() {
  const t = useTranslations('HumanChatPanel');
  const params = useParams<{ id?: string }>();
  const spaceSlug = params?.id;

  const matrix = useMatrix();
  const {
    client,
    isMatrixAvailable,
    isAuthenticated: isMatrixAuthenticated,
  } = matrix;

  // Store matrix methods in a ref to avoid infinite re-render loops.
  // These callbacks change identity when `client` state updates in the provider,
  // which would re-trigger useEffects that call setState, causing a cycle.
  const matrixRef = useRef(matrix);
  matrixRef.current = matrix;

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef<string | null>(null); // tracks which space slug is joined

  const currentUserId = client?.getUserId?.() ?? null;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  // Reset chat state when space changes
  useEffect(() => {
    // If we're already joined to a different space (or no space), reset
    if (joinedRef.current && joinedRef.current !== spaceSlug) {
      // Unregister old listener
      if (roomId) {
        matrixRef.current.unregisterRoomListerner(roomId);
      }
      joinedRef.current = null;
      setRoomId(null);
      setMessages([]);
      setInput('');
      setError(null);
    }
  }, [spaceSlug, roomId]);

  // Join room and load initial messages when Matrix is ready
  useEffect(() => {
    if (
      !isMatrixAvailable ||
      !isMatrixAuthenticated ||
      joinedRef.current === spaceSlug
    )
      return;
    if (!spaceSlug) return;

    let cancelled = false;
    const { joinRoom, createRoom, getRoomMessages } = matrixRef.current;

    const initRoom = async () => {
      setIsJoining(true);
      setError(null);
      try {
        // Check if we have a stored room ID for this space
        let targetRoomId = getStoredRoomId(spaceSlug);

        if (targetRoomId) {
          // Try to join the stored room
          try {
            await joinRoom(targetRoomId);
          } catch {
            // Room no longer exists — clear and create new
            targetRoomId = null;
          }
        }

        if (!targetRoomId) {
          // Create a new room for this space
          console.log('[HumanRightPanel] Creating room for space:', spaceSlug);
          const { roomId: newRoomId } = await createRoom(`space-${spaceSlug}`);
          targetRoomId = newRoomId;
          storeRoomId(spaceSlug, newRoomId);
        }

        if (cancelled) return;
        joinedRef.current = spaceSlug;
        setRoomId(targetRoomId);

        // Load existing messages
        const existing = getRoomMessages(targetRoomId);
        if (existing && !cancelled) {
          setMessages(
            existing.map((m) => toUIMessage(m, currentUserIdRef.current)),
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[HumanRightPanel] Failed to join room:', err);
          setError('Failed to join chat room');
        }
      } finally {
        if (!cancelled) setIsJoining(false);
      }
    };

    initRoom();

    return () => {
      cancelled = true;
    };
  }, [isMatrixAvailable, isMatrixAuthenticated, spaceSlug]);

  // Register listener for incoming messages
  useEffect(() => {
    if (!roomId || !isMatrixAvailable) return;

    const { registerRoomListener, unregisterRoomListerner } = matrixRef.current;

    registerRoomListener(roomId, async (message: Message) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, toUIMessage(message, currentUserIdRef.current)];
      });
    });

    return () => {
      unregisterRoomListerner(roomId);
    };
  }, [roomId, isMatrixAvailable]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !roomId) return;
    const text = input;
    setInput('');
    try {
      await matrixRef.current.sendMessage({ roomId, message: text });
    } catch (err) {
      console.error('[HumanRightPanel] Failed to send message:', err);
      // Restore input on failure
      setInput(text);
    }
  }, [input, roomId]);

  return (
    <>
      <SidebarHeader className="bg-background-2 p-0">
        <HumanChatPanelHeader />
      </SidebarHeader>
      <SidebarContent className="bg-background-2 min-h-0">
        {error && (
          <div
            role="alert"
            className="mx-3 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        {isJoining ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-sm text-muted-foreground">{t('loading')}</div>
          </div>
        ) : (
          <HumanChatPanelMessages messages={messages} />
        )}
      </SidebarContent>
      <SidebarFooter className="bg-background-2 p-0">
        <HumanChatPanelChatBar
          value={input}
          onChange={setInput}
          onSend={handleSend}
        />
      </SidebarFooter>
    </>
  );
}
