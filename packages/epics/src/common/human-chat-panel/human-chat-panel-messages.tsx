'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { HumanChatPanelMessageBubble } from './human-chat-panel-message-bubble';

type UIMessage = {
  id: string;
  role: 'user' | 'member';
  /** Non-Matrix / system rows: no reply or reactions. */
  isSynthetic?: boolean;
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
  senderName?: string;
  avatarUrl?: string;
  timestamp?: Date;
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
  /** Map Matrix user id to display name for reaction hover tooltips. */
  resolveReactionReactorLabel?: (userId: string) => string;
};

export function HumanChatPanelMessages({
  messages,
  isStreaming = false,
  onReply,
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
          return (
            <HumanChatPanelMessageBubble
              key={msg.id}
              message={msg}
              resolveReactionReactorLabel={resolveReactionReactorLabel}
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
            />
          );
        })}
      </div>
    </div>
  );
}
