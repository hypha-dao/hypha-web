'use client';

import { useEffect, useRef, useState } from 'react';
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
  };
};

type HumanChatPanelMessagesProps = {
  messages: UIMessage[];
  isStreaming?: boolean;
  onReply?: (messageId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  /** Keep the hover action bar visible for this message (e.g. while editing it). */
  persistHoverActionBarMessageId?: string | null;
  /** Up to three emoji shown ahead of the action icons (Discord-style quick react). */
  quickReactionEmojis?: string[];
  /** Matrix room id for deep-linking messages (copy message link). */
  matrixRoomId?: string | null;
  onEditMessage?: (messageId: string) => void;
  /** Map Matrix user id to display name for reaction hover tooltips. */
  resolveReactionReactorLabel?: (userId: string) => string;
};

export function HumanChatPanelMessages({
  messages,
  isStreaming = false,
  onReply,
  onToggleReaction,
  persistHoverActionBarMessageId = null,
  quickReactionEmojis,
  matrixRoomId,
  onEditMessage,
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
  /** At most one floating action bar: pointer hover, or locked while that row's hover emoji picker is open. */
  const [hoverActionMessageId, setHoverActionMessageId] = useState<
    string | null
  >(null);
  const [lockActionMessageId, setLockActionMessageId] = useState<string | null>(
    null,
  );
  const lockActionMessageIdRef = useRef<string | null>(null);
  lockActionMessageIdRef.current = lockActionMessageId;
  const combinedLockMessageId =
    persistHoverActionBarMessageId ?? lockActionMessageId;
  const combinedLockMessageIdRef = useRef<string | null>(null);
  combinedLockMessageIdRef.current = combinedLockMessageId;
  /** Pointer left row while hover picker was open (portal); hide bar when picker closes. */
  const leaveWhileLockedRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isStreaming]);

  const displayMessages = messages.length > 0 ? messages : [welcomeMessage];

  return (
    <div
      ref={containerRef}
      className="narrow-scrollbar flex min-w-0 flex-1 flex-col overflow-y-auto px-3 py-3"
    >
      <div className="flex flex-col gap-4">
        {displayMessages.map((msg, index) => {
          const canInteract = !msg.isSynthetic;
          const textParts =
            msg.parts?.filter(
              (p): p is { type: 'text'; text: string } => p.type === 'text',
            ) ?? [];
          const textContent = textParts.map((p) => p.text).join('');
          const canEditThis =
            canInteract &&
            msg.role === 'user' &&
            textContent.trim().length > 0 &&
            Boolean(onEditMessage);
          const isActionBarVisible =
            combinedLockMessageId === msg.id ||
            (hoverActionMessageId === msg.id && combinedLockMessageId == null);
          return (
            <HumanChatPanelMessageBubble
              key={msg.id}
              message={msg}
              resolveReactionReactorLabel={resolveReactionReactorLabel}
              isActionBarVisible={isActionBarVisible}
              onRowPointerEnter={() => {
                leaveWhileLockedRef.current = null;
                setHoverActionMessageId(msg.id);
              }}
              onRowPointerLeave={() => {
                if (combinedLockMessageIdRef.current === msg.id) {
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
              onMoreMenuOpenChange={(open) => {
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
              matrixRoomId={matrixRoomId ?? undefined}
              isStreaming={
                msg.role === 'member' &&
                isStreaming &&
                index === displayMessages.length - 1
              }
              onReply={
                canInteract && onReply ? () => onReply(msg.id) : undefined
              }
              onReact={
                canInteract && onToggleReaction
                  ? (emoji: string) => onToggleReaction(msg.id, emoji)
                  : undefined
              }
              quickReactionEmojis={quickReactionEmojis}
              onEditMessage={
                canEditThis && onEditMessage
                  ? () => onEditMessage(msg.id)
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
