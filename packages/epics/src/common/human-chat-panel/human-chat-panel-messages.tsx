'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { HumanChatPanelMessageBubble } from './human-chat-panel-message-bubble';
import type { ChatPanelAttachmentMedia } from './chat-panel-media-types';

type UIMessage = {
  id: string;
  role: 'user' | 'member';
  /** Non-Matrix / system rows: no reply or reactions. */
  isSynthetic?: boolean;
  sendPending?: {
    attachmentCount: number;
    captionPreview: string;
    uploadedCount?: number;
  };
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
  media?: ChatPanelAttachmentMedia;
  /** Multiple attachments in one Matrix event (`org.hypha.media_bundle`). */
  mediaSlots?: ChatPanelAttachmentMedia[];
  senderName?: string;
  /** Matrix author MXID when known. */
  senderMatrixId?: string;
  avatarUrl?: string;
  timestamp?: Date;
  formattedContentHtml?: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    includesCurrentUser?: boolean;
    reactorUserIds?: string[];
  }>;
  replyTo?: {
    authorLabel: string;
    excerpt?: string;
    authorAvatarUrl?: string;
  };
};

type HumanChatPanelMessagesProps = {
  messages: UIMessage[];
  isStreaming?: boolean;
  roomId?: string | null;
  currentUserId?: string | null;
  onReply?: (messageId: string) => void;
  onEditMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  /** Map Matrix user id to display name for reaction hover tooltips. */
  resolveReactionReactorLabel?: (userId: string) => string;
};

export function HumanChatPanelMessages({
  messages,
  isStreaming = false,
  roomId,
  currentUserId,
  onReply,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  resolveReactionReactorLabel,
}: HumanChatPanelMessagesProps) {
  const t = useTranslations('HumanChatPanel');

  const welcomeMessage: UIMessage = {
    id: 'welcome',
    role: 'member',
    isSynthetic: true,
    parts: [{ type: 'text', text: t('welcome') }],
    senderName: t('systemSender'),
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const prevLastIdRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);
  /** At most one floating action bar: pointer hover, or locked while that row's hover emoji picker is open. */
  const [hoverActionMessageId, setHoverActionMessageId] = useState<
    string | null
  >(null);
  const [lockActionMessageId, setLockActionMessageId] = useState<string | null>(
    null,
  );
  const lockActionMessageIdRef = useRef<string | null>(null);
  lockActionMessageIdRef.current = lockActionMessageId;
  /** Pointer left row while hover picker was open (portal); hide bar when picker closes. */
  const leaveWhileLockedRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const len = messages.length;
    const lastId = len > 0 ? messages[len - 1]!.id : null;
    const prevLen = prevLenRef.current;
    const prevLastId = prevLastIdRef.current;

    const appended =
      len > prevLen ||
      (len === prevLen && len > 0 && lastId != null && lastId !== prevLastId);

    if (appended) {
      stickToBottomRef.current = true;
    }

    if (stickToBottomRef.current || isStreaming) {
      container.scrollTop = container.scrollHeight;
    }

    prevLenRef.current = len;
    prevLastIdRef.current = lastId;
  }, [messages, isStreaming]);

  const displayMessages = messages.length > 0 ? messages : [welcomeMessage];

  return (
    <div
      ref={containerRef}
      onScroll={() => {
        const el = containerRef.current;
        if (!el) return;
        const threshold = 80;
        const distanceFromBottom =
          el.scrollHeight - el.scrollTop - el.clientHeight;
        stickToBottomRef.current = distanceFromBottom <= threshold;
      }}
      className="narrow-scrollbar flex min-w-0 flex-1 flex-col overflow-y-auto px-3 py-3"
    >
      <div className="flex flex-col gap-4">
        {displayMessages.map((msg, index) => {
          const canInteract = !msg.isSynthetic;
          const isActionBarVisible =
            lockActionMessageId === msg.id ||
            (hoverActionMessageId === msg.id && lockActionMessageId == null);
          return (
            <HumanChatPanelMessageBubble
              key={msg.id}
              message={msg}
              roomId={roomId}
              currentUserId={currentUserId}
              resolveReactionReactorLabel={resolveReactionReactorLabel}
              isActionBarVisible={isActionBarVisible}
              onRowPointerEnter={() => {
                leaveWhileLockedRef.current = null;
                setHoverActionMessageId(msg.id);
              }}
              onRowPointerLeave={() => {
                if (lockActionMessageIdRef.current === msg.id) {
                  leaveWhileLockedRef.current = msg.id;
                  return;
                }
                setHoverActionMessageId((current) =>
                  current === msg.id ? null : current,
                );
              }}
              onHoverReactPickerOpenChange={(open) => {
                if (open) {
                  setLockActionMessageId(msg.id);
                  return;
                }
                setLockActionMessageId((cur) => (cur === msg.id ? null : cur));
                if (leaveWhileLockedRef.current === msg.id) {
                  leaveWhileLockedRef.current = null;
                  setHoverActionMessageId((current) =>
                    current === msg.id ? null : current,
                  );
                }
              }}
              isStreaming={
                msg.role === 'member' &&
                isStreaming &&
                index === displayMessages.length - 1
              }
              onReply={
                canInteract && onReply ? () => onReply(msg.id) : undefined
              }
              onEdit={
                canInteract &&
                onEditMessage &&
                msg.role === 'user' &&
                !msg.sendPending
                  ? () => onEditMessage(msg.id)
                  : undefined
              }
              onDeleteMessage={
                canInteract && onDeleteMessage ? onDeleteMessage : undefined
              }
              onReact={
                canInteract && onToggleReaction
                  ? (emoji: string) => onToggleReaction(msg.id, emoji)
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
