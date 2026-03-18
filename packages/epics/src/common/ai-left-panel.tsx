'use client';

import { useState } from 'react';

import { cn } from '@hypha-platform/ui-utils';

import {
  AiPanelHeader,
  AiPanelMessages,
  AiPanelChatBar,
  MOCK_MODEL_OPTIONS,
  MOCK_SUGGESTIONS,
  MOCK_WELCOME_MESSAGE,
} from './ai-panel';

type AiLeftPanelProps = {
  onClose: () => void;
  className?: string;
};

export function AiLeftPanel({ onClose, className }: AiLeftPanelProps) {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(MOCK_MODEL_OPTIONS[0]!);
  const [messages, setMessages] = useState([MOCK_WELCOME_MESSAGE]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSend = () => {
    // Placeholder - no business logic
  };

  const handleSuggestionSelect = (text: string) => {
    setShowSuggestions(false);
    setInput(text);
  };

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r border-border bg-background-2',
        className,
      )}
    >
      <AiPanelHeader
        onClose={onClose}
        modelOptions={MOCK_MODEL_OPTIONS}
        selectedModel={selectedModel}
        onModelSelect={setSelectedModel}
      />

      <AiPanelMessages
        messages={messages}
        suggestions={MOCK_SUGGESTIONS}
        showSuggestions={showSuggestions}
        onSuggestionSelect={handleSuggestionSelect}
      />

      <AiPanelChatBar
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isStreaming={isStreaming}
      />
    </div>
  );
}
