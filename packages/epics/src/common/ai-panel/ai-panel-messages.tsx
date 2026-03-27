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

export function AiPanelMessages({
  messages,
  suggestions,
  showSuggestions,
  onSuggestionSelect,
  isStreaming = false,
}: AiPanelMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const welcomeMessage: UIMessage = {
    id: 'welcome',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: "Hello! I'm your Hypha AI assistant. I can help you analyze signals, draft proposals, understand community dynamics, and coordinate across spaces. What would you like to explore?",
      },
    ],
  };

  const displayMessages = messages.length > 0 ? messages : [welcomeMessage];

  return (
    <div className="narrow-scrollbar flex min-w-0 flex-1 flex-col overflow-y-auto px-3 py-3">
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
      <div ref={endRef} />
    </div>
  );
}
