'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

import { cn } from '@hypha-platform/ui-utils';

import {
  AiPanelHeader,
  AiPanelMessages,
  AiPanelChatBar,
  MODEL_OPTIONS,
  MOCK_SUGGESTIONS,
} from './ai-panel';

type AiLeftPanelProps = {
  onClose: () => void;
  className?: string;
};

export function AiLeftPanel({ onClose, className }: AiLeftPanelProps) {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0]!);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text }, { body: { modelId: selectedModel.id } });
    setInput('');
    setShowSuggestions(false);
  };

  const handleSuggestionSelect = (text: string) => {
    setShowSuggestions(false);
    setInput(text);
  };

  const handleResetChat = () => {
    setMessages([]);
    setShowSuggestions(true);
  };

  const handleStop = () => {
    stop();
  };

  return (
    <div
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden border-r border-border bg-background-2',
        className,
      )}
    >
      <AiPanelHeader
        onClose={onClose}
        modelOptions={MODEL_OPTIONS}
        selectedModel={selectedModel}
        onModelSelect={setSelectedModel}
        onResetChat={handleResetChat}
      />

      <AiPanelMessages
        messages={messages}
        suggestions={MOCK_SUGGESTIONS}
        showSuggestions={showSuggestions}
        onSuggestionSelect={handleSuggestionSelect}
        isStreaming={isStreaming}
      />

      <AiPanelChatBar
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
      />
    </div>
  );
}
