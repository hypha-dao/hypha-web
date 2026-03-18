'use client';

import { useRef } from 'react';

import { AiPanelMessageBubble } from './ai-panel-message-bubble';
import { AiPanelSuggestions } from './ai-panel-suggestions';
import type { Message } from './mock-data';

type AiPanelMessagesProps = {
  messages: Message[];
  suggestions: readonly string[];
  showSuggestions: boolean;
  onSuggestionSelect: (text: string) => void;
};

export function AiPanelMessages({
  messages,
  suggestions,
  showSuggestions,
  onSuggestionSelect,
}: AiPanelMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);

  return (
    <div className="narrow-scrollbar flex flex-1 flex-col overflow-y-auto px-3 py-3">
      <div className="flex flex-col gap-4">
        {messages.map((msg) => (
          <AiPanelMessageBubble key={msg.id} message={msg} />
        ))}

        {showSuggestions && messages.length <= 1 && (
          <AiPanelSuggestions suggestions={suggestions} onSelect={onSuggestionSelect} />
        )}
      </div>
      <div ref={endRef} />
    </div>
  );
}
