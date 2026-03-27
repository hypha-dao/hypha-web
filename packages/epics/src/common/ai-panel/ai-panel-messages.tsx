'use client';

import { useEffect, useRef } from 'react';

import { AiPanelMessageBubble } from './ai-panel-message-bubble';
import { AiPanelSuggestions } from './ai-panel-suggestions';

type UIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
};

type AiPanelMessagesProps = {
  messages: UIMessage[];
  suggestions: readonly string[];
  showSuggestions: boolean;
  onSuggestionSelect: (text: string) => void;
  isStreaming?: boolean;
};

const WELCOME_MESSAGE: UIMessage = {
  id: 'welcome',
  role: 'assistant',
  parts: [
    {
      type: 'text',
      text: "Hello! I'm your Hypha AI assistant. I can look up space details like member counts, agreements, and structure. Ask me anything about the space you're viewing.",
    },
  ],
};

export function AiPanelMessages({
  messages,
  suggestions,
  showSuggestions,
  onSuggestionSelect,
  isStreaming = false,
}: AiPanelMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isStreaming]);

  const displayMessages = messages.length > 0 ? messages : [WELCOME_MESSAGE];

  return (
    <div
      ref={containerRef}
      className="narrow-scrollbar flex min-w-0 flex-1 flex-col overflow-y-auto px-3 py-3"
    >
      <div className="flex flex-col gap-4">
        {displayMessages.map((msg, index) => (
          <AiPanelMessageBubble
            key={msg.id}
            message={msg}
            isStreaming={
              msg.role === 'assistant' &&
              isStreaming &&
              index === displayMessages.length - 1
            }
          />
        ))}

        {showSuggestions && messages.length <= 1 && (
          <AiPanelSuggestions
            suggestions={suggestions}
            onSelect={onSuggestionSelect}
          />
        )}
      </div>
    </div>
  );
}
