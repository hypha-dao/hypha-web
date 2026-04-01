'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from '@hypha-platform/ui';
import { useMatrix, Message } from '@hypha-platform/core/client';

import {
  HumanChatPanelHeader,
  HumanChatPanelMessages,
  HumanChatPanelChatBar,
  HumanChatPanelTabs,
  HumanChatPanelMembers,
} from './human-chat-panel';
import type { ChatPanelTab } from './human-chat-panel';
import { useHumanChatPanel } from './human-chat-panel-context';

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
  const matrixRef = useRef(matrix);
  matrixRef.current = matrix;

  const { mode, coherenceRoomId, coherenceTitle, closeCoherenceChat } =
    useHumanChatPanel();
  const { open: sidebarOpen } = useSidebar();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatPanelTab>('chat');
  const joinedRef = useRef<string | null>(null);

  const currentUserId = client?.getUserId?.() ?? null;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  // Track previous sidebar open state to detect close events
  const prevSidebarOpenRef = useRef(sidebarOpen);
  useEffect(() => {
    if (prevSidebarOpenRef.current && !sidebarOpen && mode === 'coherence') {
      closeCoherenceChat();
    }
    prevSidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen, mode, closeCoherenceChat]);

  // Reset chat state when space changes
  useEffect(() => {
    if (joinedRef.current && joinedRef.current !== spaceSlug) {
      if (roomId) {
        matrixRef.current.unregisterRoomListener(roomId);
      }
      joinedRef.current = null;
      setRoomId(null);
      setMessages([]);
      setInput('');
      setError(null);
    }
  }, [spaceSlug, roomId]);

  // Join space room when Matrix is ready (space mode)
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
        let targetRoomId = getStoredRoomId(spaceSlug);

        if (targetRoomId) {
          try {
            await joinRoom(targetRoomId);
          } catch {
            targetRoomId = null;
          }
        }

        if (!targetRoomId) {
          console.log('[HumanRightPanel] Creating room for space:', spaceSlug);
          const { roomId: newRoomId } = await createRoom(`space-${spaceSlug}`);
          targetRoomId = newRoomId;
          storeRoomId(spaceSlug, newRoomId);
        }

        if (cancelled) return;
        joinedRef.current = spaceSlug;
        setRoomId(targetRoomId);

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

  // Clear messages and unregister listener when switching modes
  useEffect(() => {
    if (mode === 'coherence') {
      // Leaving space mode — unregister space room listener and clear state
      if (roomId) {
        matrixRef.current.unregisterRoomListener(roomId);
      }
      joinedRef.current = null; // allow space room to re-init when returning
      setMessages([]);
      setRoomId(null);
      setError(null);
    }
    if (mode === 'space') {
      // Returning to space mode — clear coherence messages so space init takes over
      setMessages([]);
      setRoomId(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Join coherence room when mode switches to 'coherence'
  useEffect(() => {
    if (
      mode !== 'coherence' ||
      !coherenceRoomId ||
      !isMatrixAvailable ||
      !isMatrixAuthenticated
    )
      return;

    // Unregister any existing space room listener before switching
    if (roomId && roomId !== coherenceRoomId) {
      matrixRef.current.unregisterRoomListener(roomId);
    }

    let cancelled = false;

    const init = async () => {
      setIsJoining(true);
      setError(null);
      setMessages([]);
      try {
        await matrixRef.current.joinRoom(coherenceRoomId);
        if (cancelled) return;
        setRoomId(coherenceRoomId);
        const existing = matrixRef.current.getRoomMessages(coherenceRoomId);
        if (existing) {
          setMessages(
            existing.map((m) => toUIMessage(m, currentUserIdRef.current)),
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            '[HumanRightPanel] Failed to join coherence room:',
            err,
          );
          setError('Failed to join conversation room');
        }
      } finally {
        if (!cancelled) setIsJoining(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [mode, coherenceRoomId, isMatrixAvailable, isMatrixAuthenticated]);

  // Register listener for incoming messages
  useEffect(() => {
    if (!roomId || !isMatrixAvailable) return;

    const { registerRoomListener, unregisterRoomListener } = matrixRef.current;

    registerRoomListener(
      roomId,
      async (message: Message) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, toUIMessage(message, currentUserIdRef.current)];
        });
      },
      async (_pinned: string[]) => {
        // pinned messages not used in human chat panel
      },
    );

    return () => {
      unregisterRoomListener(roomId);
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
      setInput(text);
    }
  }, [input, roomId]);

  return (
    <>
      <SidebarHeader className="bg-background-2 p-0">
        <HumanChatPanelHeader
          title={mode === 'coherence' ? coherenceTitle ?? undefined : undefined}
          onBack={mode === 'coherence' ? closeCoherenceChat : undefined}
        />
        <HumanChatPanelTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </SidebarHeader>
      <SidebarContent className="bg-background-2 min-h-0">
        {activeTab === 'chat' && (
          <>
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
                <div className="text-sm text-muted-foreground">
                  {t('loading')}
                </div>
              </div>
            ) : (
              <HumanChatPanelMessages messages={messages} />
            )}
          </>
        )}
        {activeTab === 'members' && <HumanChatPanelMembers />}
      </SidebarContent>
      {activeTab === 'chat' && (
        <SidebarFooter className="bg-background-2 p-0">
          <HumanChatPanelChatBar
            value={input}
            onChange={setInput}
            onSend={handleSend}
          />
        </SidebarFooter>
      )}
    </>
  );
}
