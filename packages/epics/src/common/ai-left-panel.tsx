'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { LogIn } from 'lucide-react';

import { useAuthentication } from '@hypha-platform/authentication';
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
  const {
    isAuthenticated,
    login,
    isLoading: isAuthLoading,
    getAccessToken,
  } = useAuthentication();
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0]!);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    const token = await getAccessToken();
    sendMessage(
      { text },
      {
        body: { modelId: selectedModel.id },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
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

  if (isAuthLoading) {
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
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
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
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            Sign in to use Hypha AI
          </p>
          <button
            type="button"
            onClick={() => login()}
            className="flex items-center gap-2 rounded-xl border border-primary bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </button>
        </div>
      </div>
    );
  }

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
