'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from '@hypha-platform/ui';
import {
  useMatrix,
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMe,
  Message,
  firstLineForReplyPreview,
  RoomEvent,
  type MessageReaction,
} from '@hypha-platform/core/client';
import { UseMembers } from '../spaces';

import {
  HumanChatPanelHeader,
  HumanChatPanelMessages,
  HumanChatPanelChatBar,
  type ChatMentionCandidate,
  HumanChatPanelTabs,
  HumanChatPanelMembers,
} from './human-chat-panel';
import type { ChatPanelTab } from './human-chat-panel';
import { useHumanChatPanel } from './human-chat-panel-context';

type UIMessage = {
  id: string;
  role: 'user' | 'member';
  /** True for non-Matrix rows (e.g. welcome); disables reply/reactions. */
  isSynthetic?: boolean;
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
  senderName?: string;
  avatarUrl?: string;
  /** Matrix event time (origin_server_ts), for header timestamp */
  timestamp?: Date;
  /** Matrix custom HTML for visible body (when sent with formatting). */
  formattedContentHtml?: string;
  /** Matrix `msgtype` when not plain text (e.g. `m.image`). */
  msgType?: string;
  /** HTTPS URL for uploaded media (from MXC). */
  mediaHttpUrl?: string;
  /** Matrix `m.file` filename when body is a caption. */
  mediaFileName?: string;
  /** MXID of the message author (for reply target resolution). */
  senderMatrixId?: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    includesCurrentUser?: boolean;
    reactorUserIds?: string[];
  }>;
  replyTo?: {
    authorLabel: string;
    excerpt?: string;
    /** Quoted author MXID when known (for label refresh). */
    sourceUserId?: string;
  };
};

type ReplyDraft = {
  messageId: string;
  authorLabel: string;
  excerpt: string;
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
function toUIMessage(
  msg: Message,
  currentUserId: string | null | undefined,
  resolveMemberLabel: (userId: string | undefined) => string,
  currentUserAvatarUrl?: string,
  resolveMediaHttpUrl?: (mxc: string | undefined) => string | undefined,
): UIMessage {
  const isCurrentUser = currentUserId ? msg.sender === currentUserId : false;

  let replyTo: UIMessage['replyTo'];
  if (msg.inReplyToEventId) {
    const authorLabel = resolveMemberLabel(msg.inReplyToSender);
    const excerpt =
      msg.inReplyToBodyPreview != null && msg.inReplyToBodyPreview !== ''
        ? msg.inReplyToBodyPreview
        : undefined;
    replyTo = {
      authorLabel,
      excerpt,
      sourceUserId: msg.inReplyToSender,
    };
  }

  const reactions =
    msg.reactions?.map((r: MessageReaction) => ({
      emoji: r.key,
      count: r.count,
      includesCurrentUser: r.includesCurrentUser,
      reactorUserIds: r.reactorUserIds,
    })) ?? undefined;

  const msgType = msg.msgType;
  const mediaHttpUrl =
    msg.mediaMxcUrl && resolveMediaHttpUrl
      ? resolveMediaHttpUrl(msg.mediaMxcUrl)
      : undefined;
  const mediaFileName = msg.mediaFileName;

  return {
    id: msg.id,
    role: isCurrentUser ? 'user' : 'member',
    isSynthetic: false,
    parts: [{ type: 'text', text: msg.content }],
    formattedContentHtml: msg.formattedContentHtml,
    msgType,
    mediaHttpUrl,
    mediaFileName,
    senderName: isCurrentUser ? undefined : resolveMemberLabel(msg.sender),
    senderMatrixId: msg.sender,
    avatarUrl: isCurrentUser ? currentUserAvatarUrl : undefined,
    timestamp: msg.timestamp,
    reactions,
    replyTo,
  };
}

function getMessagePlainText(m: UIMessage): string {
  const textParts =
    m.parts?.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text',
    ) ?? [];
  return textParts.map((p) => p.text).join('');
}

type HumanRightPanelProps = {
  useMembers: UseMembers;
};

export function HumanRightPanel({ useMembers }: HumanRightPanelProps) {
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

  const {
    mode,
    coherenceRoomId,
    coherenceTitle,
    coherenceSlug,
    closeCoherenceChat,
    openCoherenceChat,
  } = useHumanChatPanel();
  const { jwt: authToken } = useJwt();
  const { person: me } = useMe();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const { open: sidebarOpen } = useSidebar();

  const currentUserAvatarUrl = me?.avatarUrl;
  const currentUserAvatarUrlRef = useRef(currentUserAvatarUrl);
  currentUserAvatarUrlRef.current = currentUserAvatarUrl;

  const [input, setInput] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatPanelTab>('chat');
  const joinedRef = useRef<string | null>(null);

  const currentUserId = client?.getUserId?.() ?? null;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  const resolveMemberLabel = useCallback(
    (userId: string | undefined) => {
      if (!userId) return t('unknownMember');
      if (currentUserId && userId === currentUserId) {
        const full = [me?.name, me?.surname].filter(Boolean).join(' ').trim();
        return full || t('you');
      }
      if (roomId && client) {
        const room = client.getRoom(roomId);
        const member = room?.getMember(userId);
        if (member?.name && member.name !== userId) {
          return member.name;
        }
      }
      return userId;
    },
    [client, roomId, currentUserId, me?.name, me?.surname, t],
  );

  const resolveMemberLabelRef = useRef(resolveMemberLabel);
  resolveMemberLabelRef.current = resolveMemberLabel;

  const resolveMediaHttpUrl = useCallback(
    (mxc: string | undefined): string | undefined => {
      if (!mxc || !client) return undefined;
      try {
        const url = client.mxcUrlToHttp(
          mxc,
          undefined,
          undefined,
          undefined,
          true,
        );
        return url ?? undefined;
      } catch {
        return undefined;
      }
    },
    [client],
  );

  const resolveMediaHttpUrlRef = useRef(resolveMediaHttpUrl);
  resolveMediaHttpUrlRef.current = resolveMediaHttpUrl;

  const mentionCandidates = useMemo((): ChatMentionCandidate[] => {
    if (!roomId || !client) return [];
    const room = client.getRoom(roomId);
    if (!room) return [];
    return room
      .getJoinedMembers()
      .map((m) => ({
        userId: m.userId,
        label: m.name && m.name !== m.userId ? m.name : m.userId,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [roomId, client]);

  useEffect(() => {
    if (!roomId || !client) return;
    setMessages((prev) =>
      prev.map((m) => {
        const newSenderName =
          m.role === 'member' && m.senderMatrixId
            ? resolveMemberLabelRef.current(m.senderMatrixId)
            : m.senderName;
        const newAuthorLabel =
          m.replyTo?.sourceUserId != null
            ? resolveMemberLabelRef.current(m.replyTo.sourceUserId)
            : m.replyTo?.authorLabel;

        const nextReply =
          m.replyTo?.sourceUserId != null
            ? {
                ...m.replyTo,
                authorLabel: newAuthorLabel ?? m.replyTo.authorLabel,
              }
            : m.replyTo;

        if (
          newSenderName === m.senderName &&
          nextReply?.authorLabel === m.replyTo?.authorLabel
        ) {
          return m;
        }

        return {
          ...m,
          senderName: newSenderName,
          replyTo: nextReply,
        };
      }),
    );
  }, [roomId, client, currentUserId, me?.name, me?.surname, t]);

  // Backfill avatar on self-authored messages after useMe() resolves
  useEffect(() => {
    if (!currentUserAvatarUrl) return;
    setMessages((prev) =>
      prev.map((uiMessage) =>
        uiMessage.role === 'user' && !uiMessage.avatarUrl
          ? { ...uiMessage, avatarUrl: currentUserAvatarUrl }
          : uiMessage,
      ),
    );
  }, [currentUserAvatarUrl]);

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
      setPendingAttachment(null);
      setReplyDraft(null);
      setError(null);
    }
  }, [spaceSlug, roomId]);

  // Join space room when Matrix is ready (space mode)
  useEffect(() => {
    if (mode !== 'space') return;
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
          const { roomId: newRoomId } = await createRoom(`space-${spaceSlug}`);
          if (!newRoomId) {
            throw new Error('Failed to create room: empty roomId returned');
          }
          targetRoomId = newRoomId;
          storeRoomId(spaceSlug, newRoomId);
        }

        if (cancelled) return;
        joinedRef.current = spaceSlug;
        setRoomId(targetRoomId);

        const existing = getRoomMessages(targetRoomId);
        if (existing && !cancelled) {
          setMessages(
            existing.map((m) =>
              toUIMessage(
                m,
                currentUserIdRef.current,
                resolveMemberLabelRef.current,
                currentUserAvatarUrlRef.current,
                resolveMediaHttpUrlRef.current,
              ),
            ),
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
  }, [mode, isMatrixAvailable, isMatrixAuthenticated, spaceSlug]);

  // Track previous mode to detect actual transitions (not initial mount)
  const prevModeRef = useRef(mode);
  useEffect(() => {
    const prevMode = prevModeRef.current;
    prevModeRef.current = mode;

    // Only act on actual mode transitions, not initial mount
    if (prevMode === mode) return;

    if (mode === 'coherence') {
      // Switching FROM space TO coherence — unregister space listener, clear state
      if (roomId) {
        matrixRef.current.unregisterRoomListener(roomId);
      }
      joinedRef.current = null; // allow space room to re-init when returning
      setMessages([]);
      setRoomId(null);
      setReplyDraft(null);
      setPendingAttachment(null);
      setError(null);
    }

    if (mode === 'space' && prevMode === 'coherence') {
      // Switching FROM coherence TO space — clear state, space init will re-run
      if (roomId) {
        matrixRef.current.unregisterRoomListener(roomId);
      }
      setMessages([]);
      setRoomId(null);
      setReplyDraft(null);
      setPendingAttachment(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Join (or create) coherence room when mode switches to 'coherence'
  useEffect(() => {
    if (mode !== 'coherence' || !isMatrixAvailable || !isMatrixAuthenticated)
      return;

    let cancelled = false;

    const init = async () => {
      setIsJoining(true);
      setError(null);
      setMessages([]);
      setReplyDraft(null);
      setPendingAttachment(null);
      try {
        let targetRoomId = coherenceRoomId;

        // If no room exists yet, only create one when we can link it back
        if (!targetRoomId) {
          if (!coherenceSlug) {
            // Cannot persist without a slug — skip room creation
            setIsJoining(false);
            return;
          }
          console.log(
            '[HumanRightPanel] Creating Matrix room for coherence:',
            coherenceSlug,
          );
          const { roomId: newRoomId } = await matrixRef.current.createRoom(
            coherenceTitle || 'Conversation',
          );
          if (cancelled) return;
          targetRoomId = newRoomId;

          try {
            await updateCoherenceBySlug({
              slug: coherenceSlug,
              roomId: newRoomId,
            });
            // Update context so subsequent opens don't re-create
            openCoherenceChat(newRoomId, coherenceTitle || '', coherenceSlug);
          } catch (err) {
            console.warn(
              '[HumanRightPanel] Failed to persist roomId to coherence:',
              err,
            );
          }
        } else {
          await matrixRef.current.joinRoom(targetRoomId);
        }

        if (cancelled) return;
        setRoomId(targetRoomId);
        const existing = matrixRef.current.getRoomMessages(targetRoomId);
        if (existing) {
          setMessages(
            existing.map((m) =>
              toUIMessage(
                m,
                currentUserIdRef.current,
                resolveMemberLabelRef.current,
                currentUserAvatarUrlRef.current,
                resolveMediaHttpUrlRef.current,
              ),
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            '[HumanRightPanel] Failed to join coherence room:',
            err,
          );
          setError(t('failedToJoinRoom'));
        }
      } finally {
        if (!cancelled) setIsJoining(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    coherenceRoomId,
    coherenceTitle,
    coherenceSlug,
    isMatrixAvailable,
    isMatrixAuthenticated,
  ]);

  // Register listener for incoming messages
  useEffect(() => {
    if (!roomId || !isMatrixAvailable) return;

    const { registerRoomListener, unregisterRoomListener } = matrixRef.current;

    registerRoomListener(
      roomId,
      async (message: Message) => {
        setMessages((prev) => {
          const next = toUIMessage(
            message,
            currentUserIdRef.current,
            resolveMemberLabelRef.current,
            currentUserAvatarUrlRef.current,
            resolveMediaHttpUrlRef.current,
          );
          const idx = prev.findIndex((m) => m.id === next.id);
          if (idx === -1) {
            return [...prev, next];
          }
          return prev.map((m, i) => (i === idx ? next : m));
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

  // Keep message ids in sync when the SDK replaces provisional ~… ids with $… after send
  useEffect(() => {
    if (!roomId || !client) return;

    const room = client.getRoom(roomId);
    if (!room) return;

    const onLocalEchoUpdated = (
      ev: MatrixEvent,
      _r: Room,
      oldEventId?: string,
    ) => {
      if (!oldEventId) return;
      const newId = ev.getId();
      if (!newId || oldEventId === newId) return;

      setMessages((prev) =>
        prev.map((m) => (m.id === oldEventId ? { ...m, id: newId } : m)),
      );
      setReplyDraft((draft) =>
        draft?.messageId === oldEventId
          ? { ...draft, messageId: newId }
          : draft,
      );
    };

    room.on(RoomEvent.LocalEchoUpdated, onLocalEchoUpdated);
    return () => {
      room.off(RoomEvent.LocalEchoUpdated, onLocalEchoUpdated);
    };
  }, [roomId, client]);

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!roomId) return;
      setReactionError(null);
      try {
        await matrixRef.current.toggleReaction({
          roomId,
          targetEventId: messageId,
          key: emoji,
        });
      } catch (err) {
        console.error('[HumanRightPanel] Failed to toggle reaction:', err);
        setReactionError(t('reactionToggleFailed'));
      }
    },
    [roomId, t],
  );

  const handleReplyToMessage = useCallback(
    (messageId: string) => {
      const target = messages.find((m) => m.id === messageId);
      if (!target) return;
      const authorLabel =
        target.role === 'user'
          ? t('you')
          : target.senderName ?? resolveMemberLabel(target.senderMatrixId);
      const excerpt = firstLineForReplyPreview(getMessagePlainText(target));
      setReplyDraft({
        messageId,
        authorLabel,
        excerpt,
      });
    },
    [messages, resolveMemberLabel, t],
  );

  const handleSend = useCallback(async () => {
    if ((!input.trim() && !pendingAttachment) || !roomId) return;
    const text = input;
    const file = pendingAttachment;
    const replyToEventId = replyDraft?.messageId;
    const savedDraft = replyDraft;
    const savedFile = file;
    setInput('');
    setPendingAttachment(null);
    setIsSendingMessage(true);
    try {
      await matrixRef.current.sendMessage({
        roomId,
        message: text.trim() ? text : file?.name ?? 'attachment',
        ...(replyToEventId ? { replyToEventId } : {}),
        ...(file ? { attachment: file } : {}),
      });
      setReplyDraft(null);
    } catch (err) {
      console.error('[HumanRightPanel] Failed to send message:', err);
      setInput(text);
      setPendingAttachment(savedFile ?? null);
      setReplyDraft(savedDraft);
    } finally {
      setIsSendingMessage(false);
    }
  }, [input, pendingAttachment, roomId, replyDraft]);

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
            {reactionError && (
              <div
                role="alert"
                className="mx-3 mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {reactionError}
              </div>
            )}
            {isJoining ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-sm text-muted-foreground">
                  {t('loading')}
                </div>
              </div>
            ) : (
              <HumanChatPanelMessages
                messages={messages}
                onReply={handleReplyToMessage}
                onToggleReaction={handleToggleReaction}
                resolveReactionReactorLabel={(userId) =>
                  resolveMemberLabel(userId)
                }
              />
            )}
          </>
        )}
        {activeTab === 'members' && (
          <HumanChatPanelMembers
            useMembers={useMembers}
            spaceSlug={spaceSlug}
          />
        )}
      </SidebarContent>
      {activeTab === 'chat' && (
        <SidebarFooter className="bg-background-2 px-0 py-0">
          <HumanChatPanelChatBar
            value={input}
            onChange={setInput}
            onSend={handleSend}
            pendingAttachment={pendingAttachment}
            onPendingAttachmentChange={setPendingAttachment}
            mentionCandidates={mentionCandidates}
            isSending={isSendingMessage}
            replyPreview={
              replyDraft
                ? {
                    authorLabel: replyDraft.authorLabel,
                    excerpt: replyDraft.excerpt,
                    onDismiss: () => setReplyDraft(null),
                  }
                : undefined
            }
          />
        </SidebarFooter>
      )}
    </>
  );
}
