'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { HumanChatPanelMessageBubble } from './human-chat-panel-message-bubble';

type UIMessage = {
  id: string;
  role: 'user' | 'member';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
  senderName?: string;
};

type HumanChatPanelMessagesProps = {
  messages: UIMessage[];
  isStreaming?: boolean;
};

export function HumanChatPanelMessages({
  messages,
  isStreaming = false,
}: HumanChatPanelMessagesProps) {
  const t = useTranslations('HumanChatPanel');

  const welcomeMessage: UIMessage = {
    id: 'welcome',
    role: 'member',
    parts: [{ type: 'text', text: t('welcome') }],
    senderName: 'System',
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
        {displayMessages.map((msg, index) => (
          <HumanChatPanelMessageBubble
            key={msg.id}
            message={msg}
            isStreaming={
              msg.role === 'member' &&
              isStreaming &&
              index === displayMessages.length - 1
            }
          />
        ))}
      </div>
    </div>
  );
}
